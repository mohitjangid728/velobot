import Razorpay from "razorpay";
import { alreadyProcessedEvent } from "@/lib/razorpay/webhook-idempotency";
import {
  applyPlanActivation,
  applyAddonSeatActivation,
  applyAddonMessagesCredit,
  resetOrgToFree,
  clearAddonSeats,
  markPastDueBySubscription,
} from "@/lib/razorpay/billing-mutations";
import type { PlanTier, BillingInterval, Currency } from "@velobot/shared";
import { recordRedemption } from "@/lib/billing/coupons";

async function recordCouponIfPresent(
  notes: Record<string, string | number>,
  orgId: string,
  purchaseKind: "messages_addon" | "plan_subscription"
) {
  if (!notes.couponId) return;
  await recordRedemption({
    couponId: String(notes.couponId),
    orgId,
    purchaseKind,
    amountDiscounted: Number(notes.amountDiscounted ?? 0),
  });
}

export const runtime = "nodejs";

interface RazorpaySubscriptionEntity {
  id: string;
  current_start?: number | null;
  current_end?: number | null;
  notes?: Record<string, string | number>;
}
interface RazorpayOrderEntity {
  id: string;
  notes?: Record<string, string | number>;
}
interface RazorpayPaymentEntity {
  id: string;
  subscription_id?: string | null;
}
interface RazorpayPaymentLinkEntity {
  id: string;
  notes?: Record<string, string | number>;
}
interface RazorpayWebhookBody {
  event: string;
  payload: {
    subscription?: { entity: RazorpaySubscriptionEntity };
    order?: { entity: RazorpayOrderEntity };
    payment?: { entity: RazorpayPaymentEntity };
    payment_link?: { entity: RazorpayPaymentLinkEntity };
  };
}

const PERIOD_SECONDS_BY_INTERVAL: Record<BillingInterval, number> = {
  monthly: 30 * 24 * 60 * 60,
  yearly: 365 * 24 * 60 * 60,
};

/** Replaces stripe/webhook/route.ts. Same responsibilities: verify signature, dedupe, mutate `organizations`. */
export async function POST(req: Request) {
  const signature = req.headers.get("x-razorpay-signature");
  const eventId = req.headers.get("x-razorpay-event-id");
  const rawBody = await req.text();

  if (!signature || !eventId) {
    return Response.json({ error: "Missing signature or event id" }, { status: 400 });
  }

  const valid = Razorpay.validateWebhookSignature(rawBody, signature, process.env.RAZORPAY_WEBHOOK_SECRET!);
  if (!valid) return Response.json({ error: "Invalid signature" }, { status: 400 });

  if (await alreadyProcessedEvent(eventId)) {
    return Response.json({ received: true, deduped: true });
  }

  const body = JSON.parse(rawBody) as RazorpayWebhookBody;
  const subscription = body.payload.subscription?.entity;
  const order = body.payload.order?.entity;
  const payment = body.payload.payment?.entity;
  const paymentLink = body.payload.payment_link?.entity;

  switch (body.event) {
    // Plan/seat purchases go out as Payment Links, not Subscriptions (see
    // checkout/route.ts's doc comment) — this is the authoritative,
    // Razorpay-driven confirmation; app/api/razorpay/verify/route.ts
    // applies the same activation immediately when the browser returns
    // from the callback_url, for fast UX when the webhook is delayed.
    // Payment Links have no ongoing subscription to renew or cancel, so
    // unlike the subscription.* cases below there's no cancelled/halted
    // counterpart here — see applyPlanActivation's doc comment for what
    // that means for renewal.
    case "payment_link.paid": {
      if (!paymentLink) break;
      const notes = paymentLink.notes ?? {};
      const orgId = notes.org_id ? String(notes.org_id) : null;
      if (!orgId) break;

      if (notes.kind === "plan") {
        const interval = notes.interval as BillingInterval;
        const now = Math.floor(Date.now() / 1000);
        await applyPlanActivation(orgId, {
          tier: notes.tier as Exclude<PlanTier, "free">,
          interval,
          currency: notes.currency as Currency,
          subscriptionId: paymentLink.id,
          currentStart: now,
          currentEnd: now + PERIOD_SECONDS_BY_INTERVAL[interval],
        });
        await recordCouponIfPresent(notes, orgId, "plan_subscription");
      } else if (notes.kind === "addon_seat") {
        await applyAddonSeatActivation(orgId, { subscriptionId: paymentLink.id, quantity: Number(notes.quantity ?? 1) });
        await recordCouponIfPresent(notes, orgId, "plan_subscription");
      }
      break;
    }
    case "subscription.activated":
    case "subscription.charged": {
      if (!subscription) break;
      const notes = subscription.notes ?? {};
      const orgId = notes.org_id ? String(notes.org_id) : null;
      if (!orgId) break;

      if (notes.kind === "plan") {
        await applyPlanActivation(orgId, {
          tier: notes.tier as Exclude<PlanTier, "free">,
          interval: notes.interval as BillingInterval,
          currency: notes.currency as Currency,
          subscriptionId: subscription.id,
          currentStart: subscription.current_start,
          currentEnd: subscription.current_end,
        });
        await recordCouponIfPresent(notes, orgId, "plan_subscription");
      } else if (notes.kind === "addon_seat") {
        await applyAddonSeatActivation(orgId, { subscriptionId: subscription.id, quantity: Number(notes.quantity ?? 1) });
        await recordCouponIfPresent(notes, orgId, "plan_subscription");
      }
      break;
    }

    case "subscription.cancelled":
    case "subscription.completed": {
      if (!subscription) break;
      // No app metadata needed here — matched by which stored subscription
      // id this is, exactly like Stripe's customer.subscription.deleted.
      await resetOrgToFree(subscription.id);
      await clearAddonSeats(subscription.id);
      break;
    }

    case "subscription.halted": {
      if (subscription) await markPastDueBySubscription(subscription.id);
      break;
    }

    case "payment.failed": {
      if (payment?.subscription_id) await markPastDueBySubscription(payment.subscription_id);
      break;
    }

    case "order.paid": {
      if (!order) break;
      const notes = order.notes ?? {};
      const orgId = notes.org_id ? String(notes.org_id) : null;
      if (!orgId || notes.kind !== "addon_messages") break;
      // Guard against the verify route already having credited this same
      // order — see app/api/razorpay/verify/route.ts's matching check.
      if (await alreadyProcessedEvent(`order_verify:${order.id}`)) break;
      await applyAddonMessagesCredit(orgId, { quantity: Number(notes.quantity ?? 1) });
      await recordCouponIfPresent(notes, orgId, "messages_addon");
      break;
    }

    default:
      break;
  }

  return Response.json({ received: true });
}
