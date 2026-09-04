import { NextResponse } from "next/server";
import { ROLE_RANK, CheckoutSessionSchema, ADDONS, getEffectivePrice } from "@velobot/shared";
import { getActiveOrg } from "@/lib/auth/session";
import { getRazorpayClient } from "@/lib/razorpay/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPlanPriceOverrides } from "@/lib/billing/plan-pricing";
import { validateCoupon, recordRedemption, type CouponValidation } from "@/lib/billing/coupons";
import { applyPlanActivation, applyAddonSeatActivation, applyAddonMessagesCredit } from "@/lib/razorpay/billing-mutations";
import type { BillingInterval, Currency, PlanTier } from "@velobot/shared";

/** A 100%-off coupon leaves nothing for Razorpay to charge (its Orders API requires a positive amount) — activate directly and skip Razorpay entirely rather than sending it a zero/negative amount. */
async function activateFreeOfCharge(
  orgId: string,
  purchase:
    | { kind: "plan"; tier: Exclude<PlanTier, "free">; interval: BillingInterval; currency: Currency }
    | { kind: "addon_messages"; quantity: number }
    | { kind: "addon_seat"; quantity: number },
  coupon: CouponValidation
): Promise<void> {
  const reference = `coupon_${coupon.coupon.id}_${Date.now()}`;
  if (purchase.kind === "plan") {
    const now = Math.floor(Date.now() / 1000);
    await applyPlanActivation(orgId, {
      tier: purchase.tier,
      interval: purchase.interval,
      currency: purchase.currency,
      subscriptionId: reference,
      currentStart: now,
      currentEnd: now + (purchase.interval === "yearly" ? 365 : 30) * 24 * 60 * 60,
    });
  } else if (purchase.kind === "addon_seat") {
    await applyAddonSeatActivation(orgId, { subscriptionId: reference, quantity: purchase.quantity });
  } else {
    await applyAddonMessagesCredit(orgId, { quantity: purchase.quantity });
  }
  await recordRedemption({
    couponId: coupon.coupon.id,
    orgId,
    purchaseKind: purchase.kind === "addon_messages" ? "messages_addon" : "plan_subscription",
    amountDiscounted: coupon.amountDiscounted,
  });
}

/**
 * Replaces stripe/checkout-session/route.ts. Every kind — plan, seat
 * add-on, messages add-on — goes out as a plain Razorpay Order opened via
 * the embedded Checkout.js popup, not a Subscription: Subscriptions
 * require a separate "Subscriptions" activation on the Razorpay account
 * that isn't available here, while Orders work with the same basic
 * Payments capability the account already has. This means plan/seat
 * purchases are one-time charges, not auto-renewing — see
 * applyPlanActivation's doc comment in billing-mutations.ts for what that
 * does and doesn't mean for renewal (in short: nothing renews
 * automatically; a fresh Order per billing period, created by our own app
 * logic rather than Razorpay, is the intended future path for that).
 */
export async function POST(req: Request) {
  const { org, role, user } = await getActiveOrg();
  if (!org || !role || !user) return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  if (ROLE_RANK[role] < ROLE_RANK.admin) {
    return NextResponse.json({ error: "Only an admin can manage billing" }, { status: 403 });
  }

  const parsed = CheckoutSessionSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const razorpay = getRazorpayClient();
    const admin = createSupabaseAdminClient();
    const keyId = process.env.RAZORPAY_KEY_ID;

    let customerId = org.razorpay_customer_id;
    if (!customerId) {
      // fail_existing "0" — if a customer with this email already exists
      // on the Razorpay account for some other reason (e.g. two orgs
      // sharing an admin email), reuse it instead of erroring, since we
      // have no other natural dedup key here. Razorpay's REST API only
      // honors this as the literal string "0"; the SDK's own published
      // type (boolean | 0 | 1) is wrong — both `0` and `false` still 400
      // with "Customer already exists" (verified directly against the
      // API), so this cast works around a bug in the type, not our code.
      const customer = await razorpay.customers.create({
        name: org.name,
        email: user.email ?? undefined,
        notes: { org_id: org.id },
        fail_existing: "0" as unknown as 0,
      });
      customerId = customer.id;
      await admin.from("organizations").update({ razorpay_customer_id: customerId }).eq("id", org.id);
    }

    if (parsed.data.kind === "plan") {
      const { tier, interval, currency, couponCode } = parsed.data;
      const overrides = await getPlanPriceOverrides();
      let amount = getEffectivePrice(tier, interval, currency, overrides);
      if (amount === undefined) {
        return NextResponse.json({ error: "This plan has no price configured for that currency/interval" }, { status: 400 });
      }

      const couponNotes: Record<string, string | number> = {};
      let coupon: CouponValidation | null = null;
      if (couponCode) {
        const result = await validateCoupon(couponCode, "plan_subscription", org.id, amount, currency);
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
        coupon = result.validation;
        amount = coupon.discountedAmount;
        couponNotes.couponId = coupon.coupon.id;
        couponNotes.couponCode = coupon.coupon.code;
        couponNotes.amountDiscounted = coupon.amountDiscounted;
      }

      if (coupon?.isFullyDiscounted) {
        await activateFreeOfCharge(org.id, { kind: "plan", tier, interval, currency }, coupon);
        return NextResponse.json({ freeActivation: true });
      }

      const order = await razorpay.orders.create({
        amount: Math.round(amount * 100),
        currency,
        notes: { org_id: org.id, kind: "plan", tier, interval, currency, ...couponNotes },
      });
      return NextResponse.json({ orderId: order.id, keyId });
    }

    const { addon, currency, quantity, couponCode } = parsed.data;
    if (addon === "messages") {
      let amount = ADDONS.messages.price[currency] * quantity;
      const couponNotes: Record<string, string | number> = {};
      let coupon: CouponValidation | null = null;
      if (couponCode) {
        const result = await validateCoupon(couponCode, "messages_addon", org.id, amount, currency);
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
        coupon = result.validation;
        amount = coupon.discountedAmount;
        couponNotes.couponId = coupon.coupon.id;
        couponNotes.couponCode = coupon.coupon.code;
        couponNotes.amountDiscounted = coupon.amountDiscounted;
      }
      if (coupon?.isFullyDiscounted) {
        await activateFreeOfCharge(org.id, { kind: "addon_messages", quantity }, coupon);
        return NextResponse.json({ freeActivation: true });
      }
      const order = await razorpay.orders.create({
        amount: amount * 100,
        currency,
        notes: { org_id: org.id, kind: "addon_messages", quantity, ...couponNotes },
      });
      return NextResponse.json({ orderId: order.id, keyId });
    }

    let seatAmount = ADDONS.seat.price[currency] * quantity;
    const couponNotes: Record<string, string | number> = {};
    let seatCoupon: CouponValidation | null = null;
    if (couponCode) {
      const result = await validateCoupon(couponCode, "plan_subscription", org.id, seatAmount, currency);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      seatCoupon = result.validation;
      seatAmount = seatCoupon.discountedAmount;
      couponNotes.couponId = seatCoupon.coupon.id;
      couponNotes.couponCode = seatCoupon.coupon.code;
      couponNotes.amountDiscounted = seatCoupon.amountDiscounted;
    }
    if (seatCoupon?.isFullyDiscounted) {
      await activateFreeOfCharge(org.id, { kind: "addon_seat", quantity }, seatCoupon);
      return NextResponse.json({ freeActivation: true });
    }
    const order = await razorpay.orders.create({
      amount: Math.round(seatAmount * 100),
      currency,
      notes: { org_id: org.id, kind: "addon_seat", quantity, ...couponNotes },
    });
    return NextResponse.json({ orderId: order.id, keyId });
  } catch (err) {
    console.error("[razorpay/checkout] Failed to create order", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to start checkout" }, { status: 500 });
  }
}
