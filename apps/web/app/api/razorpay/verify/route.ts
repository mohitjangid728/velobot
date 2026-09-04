import { NextResponse } from "next/server";
import { z } from "zod";
import { ROLE_RANK } from "@velobot/shared";
import type { PlanTier, BillingInterval, Currency } from "@velobot/shared";
import { validatePaymentVerification } from "razorpay/dist/utils/razorpay-utils";
import { getActiveOrg } from "@/lib/auth/session";
import { getRazorpayClient } from "@/lib/razorpay/client";
import { applyPlanActivation, applyAddonSeatActivation, applyAddonMessagesCredit } from "@/lib/razorpay/billing-mutations";
import { alreadyProcessedEvent } from "@/lib/razorpay/webhook-idempotency";
import { recordRedemption } from "@/lib/billing/coupons";

/** Reads the couponId/amountDiscounted this checkout route stamped into notes (if a coupon was used) and records the redemption — a no-op if notes.couponId is absent. */
async function recordCouponIfPresent(
  notes: Record<string, unknown>,
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

const VerifyOrderSchema = z.object({
  razorpay_payment_id: z.string(),
  razorpay_order_id: z.string(),
  razorpay_signature: z.string(),
});
const VerifySubscriptionSchema = z.object({
  razorpay_payment_id: z.string(),
  razorpay_subscription_id: z.string(),
  razorpay_signature: z.string(),
});

/**
 * Client-driven confirmation path — Razorpay Checkout's success handler
 * runs entirely in the browser, so unlike Stripe (webhook-only source of
 * truth) we verify + apply here too, for fast UX, in addition to the
 * webhook (which is still the authoritative path if this call never
 * fires — closed tab, network drop). Both paths are idempotent and both
 * fetch the authoritative entity from Razorpay rather than trusting any
 * client-supplied plan details — the signature only proves
 * payment↔order/subscription pairing, not what the client claims it
 * bought. See lib/razorpay/billing-mutations.ts's doc comment.
 */
export async function POST(req: Request) {
  const { org, role } = await getActiveOrg();
  if (!org || !role) return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  if (ROLE_RANK[role] < ROLE_RANK.admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const secret = process.env.RAZORPAY_KEY_SECRET!;

  const orderAttempt = VerifyOrderSchema.safeParse(body);
  const subscriptionAttempt = VerifySubscriptionSchema.safeParse(body);
  if (!orderAttempt.success && !subscriptionAttempt.success) {
    return NextResponse.json({ error: "Invalid verification payload" }, { status: 400 });
  }

  const razorpay = getRazorpayClient();

  try {
    if (orderAttempt.success) {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = orderAttempt.data;
      const valid = validatePaymentVerification(
        { payment_id: razorpay_payment_id, order_id: razorpay_order_id },
        razorpay_signature,
        secret
      );
      if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

      const order = await razorpay.orders.fetch(razorpay_order_id);
      const notes = order.notes ?? {};
      if (String(notes.org_id) !== org.id) return NextResponse.json({ error: "Order does not belong to this workspace" }, { status: 403 });

      // Guard against the webhook (order.paid) already having applied this
      // same order — this route and the webhook race, and
      // applyAddonMessagesCredit is additive, so double-firing would
      // double-credit without this check (applyPlanActivation/
      // applyAddonSeatActivation are plain overwrites and wouldn't
      // double-apply either way, but the guard is shared across all three
      // kinds for one order rather than split apart).
      if (await alreadyProcessedEvent(`order_verify:${razorpay_order_id}`)) {
        return NextResponse.json({ ok: true, deduped: true });
      }
      if (notes.kind === "addon_messages") {
        await applyAddonMessagesCredit(org.id, { quantity: Number(notes.quantity ?? 1) });
        await recordCouponIfPresent(notes, org.id, "messages_addon");
      } else if (notes.kind === "plan") {
        const interval = notes.interval as BillingInterval;
        const now = Math.floor(Date.now() / 1000);
        await applyPlanActivation(org.id, {
          tier: notes.tier as Exclude<PlanTier, "free">,
          interval,
          currency: notes.currency as Currency,
          subscriptionId: razorpay_order_id,
          currentStart: now,
          currentEnd: now + (interval === "yearly" ? 365 : 30) * 24 * 60 * 60,
        });
        await recordCouponIfPresent(notes, org.id, "plan_subscription");
      } else if (notes.kind === "addon_seat") {
        await applyAddonSeatActivation(org.id, { subscriptionId: razorpay_order_id, quantity: Number(notes.quantity ?? 1) });
        await recordCouponIfPresent(notes, org.id, "plan_subscription");
      }
      return NextResponse.json({ ok: true });
    }

    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = subscriptionAttempt.data as z.infer<typeof VerifySubscriptionSchema>;
    const valid = validatePaymentVerification(
      { payment_id: razorpay_payment_id, subscription_id: razorpay_subscription_id },
      razorpay_signature,
      secret
    );
    if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

    const subscription = await razorpay.subscriptions.fetch(razorpay_subscription_id);
    const notes = subscription.notes ?? {};
    if (String(notes.org_id) !== org.id) return NextResponse.json({ error: "Subscription does not belong to this workspace" }, { status: 403 });

    if (await alreadyProcessedEvent(`sub_verify:${razorpay_subscription_id}:${subscription.current_start ?? "initial"}`)) {
      return NextResponse.json({ ok: true, deduped: true });
    }

    if (notes.kind === "plan") {
      await applyPlanActivation(org.id, {
        tier: notes.tier as Exclude<PlanTier, "free">,
        interval: notes.interval as BillingInterval,
        currency: notes.currency as Currency,
        subscriptionId: subscription.id,
        currentStart: subscription.current_start,
        currentEnd: subscription.current_end,
      });
      await recordCouponIfPresent(notes, org.id, "plan_subscription");
    } else if (notes.kind === "addon_seat") {
      await applyAddonSeatActivation(org.id, { subscriptionId: subscription.id, quantity: Number(notes.quantity ?? 1) });
      await recordCouponIfPresent(notes, org.id, "plan_subscription");
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[razorpay/verify] Verification failed", err);
    return NextResponse.json({ error: "Could not verify payment" }, { status: 500 });
  }
}
