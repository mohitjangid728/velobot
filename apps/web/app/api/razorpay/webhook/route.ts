import Razorpay from "razorpay";
import { alreadyProcessedEvent } from "@/lib/razorpay/webhook-idempotency";
import {
  applyPlanActivation,
  applyAddonSeatActivation,
  applyAddonMessagesCredit,
  resetOrgToFree,
  clearAddonSeats,
  markPastDueBySubscription,
  purchaseLineItem,
} from "@/lib/razorpay/billing-mutations";
import type { PlanTier, BillingInterval, Currency } from "@velobot/shared";
import { recordRedemption } from "@/lib/billing/coupons";
import { sendInvoiceEmail } from "@/lib/notifications/invoice-email";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** No authenticated user in a webhook — stands in as the purchase's recipient, same as the offline-capture notification's "primary contact" concept. */
async function getPrimaryAdminEmail(orgId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data: primaryAdmin } = await admin
    .from("org_members")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("role", "admin")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!primaryAdmin?.user_id) return null;
  const { data: userRes } = await admin.auth.admin.getUserById(primaryAdmin.user_id);
  return userRes.user?.email ?? null;
}

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
  amount: number | string;
  notes?: Record<string, string | number>;
}
interface RazorpayPaymentEntity {
  id: string;
  subscription_id?: string | null;
}
interface RazorpayWebhookBody {
  event: string;
  payload: {
    subscription?: { entity: RazorpaySubscriptionEntity };
    order?: { entity: RazorpayOrderEntity };
    payment?: { entity: RazorpayPaymentEntity };
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

  switch (body.event) {
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
      if (!orgId) break;
      // Guard against the verify route already having applied this same
      // order — see app/api/razorpay/verify/route.ts's matching check.
      // This route and that one race (client callback vs. webhook); this
      // is what makes double-firing a no-op instead of a double-credit.
      if (await alreadyProcessedEvent(`order_verify:${order.id}`)) break;

      if (notes.kind === "addon_messages") {
        await applyAddonMessagesCredit(orgId, { quantity: Number(notes.quantity ?? 1) });
        await recordCouponIfPresent(notes, orgId, "messages_addon");
      } else if (notes.kind === "plan") {
        // Plan purchases go out as plain Orders, not Subscriptions (see
        // checkout/route.ts's doc comment) — this is the authoritative,
        // Razorpay-driven confirmation; verify/route.ts applies the same
        // activation immediately when the client-side handler fires, for
        // fast UX when this webhook is delayed. An Order has no ongoing
        // subscription to renew or cancel, so unlike the subscription.*
        // cases above there's no cancelled/halted counterpart here — see
        // applyPlanActivation's doc comment for what that means for
        // renewal.
        const interval = notes.interval as BillingInterval;
        const now = Math.floor(Date.now() / 1000);
        await applyPlanActivation(orgId, {
          tier: notes.tier as Exclude<PlanTier, "free">,
          interval,
          currency: notes.currency as Currency,
          subscriptionId: order.id,
          currentStart: now,
          currentEnd: now + PERIOD_SECONDS_BY_INTERVAL[interval],
        });
        await recordCouponIfPresent(notes, orgId, "plan_subscription");
      } else if (notes.kind === "addon_seat") {
        await applyAddonSeatActivation(orgId, { subscriptionId: order.id, quantity: Number(notes.quantity ?? 1) });
        await recordCouponIfPresent(notes, orgId, "plan_subscription");
      }

      const admin = createSupabaseAdminClient();
      const [{ data: orgRow }, adminEmail] = await Promise.all([
        admin.from("organizations").select("name").eq("id", orgId).single(),
        getPrimaryAdminEmail(orgId),
      ]);
      if (adminEmail && orgRow) {
        await sendInvoiceEmail(adminEmail, {
          orgName: orgRow.name,
          lineItem: purchaseLineItem(notes),
          amount: Number(order.amount) / 100,
          currency: (notes.currency as Currency) ?? "USD",
          orderId: order.id,
          date: new Date(),
        });
      }
      break;
    }

    default:
      break;
  }

  return Response.json({ received: true });
}
