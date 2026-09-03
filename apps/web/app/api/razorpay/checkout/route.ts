import { NextResponse } from "next/server";
import { ROLE_RANK, CheckoutSessionSchema, ADDONS, getEffectivePrice } from "@velobot/shared";
import { getActiveOrg } from "@/lib/auth/session";
import { getRazorpayClient, TOTAL_COUNT_BY_INTERVAL } from "@/lib/razorpay/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPlanId, getAddonSeatPlanId } from "@/lib/razorpay/plan-map";
import { getPlanPriceOverrides } from "@/lib/billing/plan-pricing";
import { validateCoupon } from "@/lib/billing/coupons";

/**
 * Replaces stripe/checkout-session/route.ts. Returns a subscription/order
 * id + the public key for the client to open Razorpay Checkout.js with —
 * there is no Stripe-style clientSecret/embedded-iframe concept here.
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
      // fail_existing:0 — if a customer with this email already exists on
      // the Razorpay account for some other reason, reuse it instead of
      // erroring, since we have no other natural dedup key here.
      const customer = await razorpay.customers.create({
        name: org.name,
        email: user.email ?? undefined,
        notes: { org_id: org.id },
        fail_existing: 0,
      });
      customerId = customer.id;
      await admin.from("organizations").update({ razorpay_customer_id: customerId }).eq("id", org.id);
    }

    if (parsed.data.kind === "plan") {
      const { tier, interval, currency, couponCode } = parsed.data;
      const planId = getPlanId(tier as Exclude<typeof tier, "free">, interval, currency);

      let offerId: string | undefined;
      const couponNotes: Record<string, string | number> = {};
      if (couponCode) {
        const overrides = await getPlanPriceOverrides();
        const originalAmount = getEffectivePrice(tier, interval, currency, overrides) ?? 0;
        const result = await validateCoupon(couponCode, "plan_subscription", org.id, originalAmount);
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
        offerId = result.validation.coupon.razorpay_offer_id ?? undefined;
        couponNotes.couponId = result.validation.coupon.id;
        couponNotes.couponCode = result.validation.coupon.code;
        couponNotes.amountDiscounted = result.validation.amountDiscounted;
      }

      const subscription = await razorpay.subscriptions.create({
        plan_id: planId,
        total_count: TOTAL_COUNT_BY_INTERVAL[interval],
        customer_notify: 1,
        ...(offerId ? { offer_id: offerId } : {}),
        notes: { org_id: org.id, kind: "plan", tier, interval, currency, ...couponNotes },
      });
      return NextResponse.json({ subscriptionId: subscription.id, keyId });
    }

    const { addon, currency, quantity, couponCode } = parsed.data;
    if (addon === "messages") {
      let amount = ADDONS.messages.price[currency] * quantity;
      const couponNotes: Record<string, string | number> = {};
      if (couponCode) {
        const result = await validateCoupon(couponCode, "messages_addon", org.id, amount);
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
        amount = result.validation.discountedAmount;
        couponNotes.couponId = result.validation.coupon.id;
        couponNotes.couponCode = result.validation.coupon.code;
        couponNotes.amountDiscounted = result.validation.amountDiscounted;
      }
      const order = await razorpay.orders.create({
        amount: amount * 100,
        currency,
        notes: { org_id: org.id, kind: "addon_messages", quantity, ...couponNotes },
      });
      return NextResponse.json({ orderId: order.id, keyId });
    }

    const planId = getAddonSeatPlanId(currency);
    let offerId: string | undefined;
    const couponNotes: Record<string, string | number> = {};
    if (couponCode) {
      const originalAmount = ADDONS.seat.price[currency] * quantity;
      const result = await validateCoupon(couponCode, "plan_subscription", org.id, originalAmount);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      offerId = result.validation.coupon.razorpay_offer_id ?? undefined;
      couponNotes.couponId = result.validation.coupon.id;
      couponNotes.couponCode = result.validation.coupon.code;
      couponNotes.amountDiscounted = result.validation.amountDiscounted;
    }
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      total_count: TOTAL_COUNT_BY_INTERVAL.monthly,
      quantity,
      customer_notify: 1,
      ...(offerId ? { offer_id: offerId } : {}),
      notes: { org_id: org.id, kind: "addon_seat", quantity, ...couponNotes },
    });
    return NextResponse.json({ subscriptionId: subscription.id, keyId });
  } catch (err) {
    // Most commonly a missing RAZORPAY_PLAN_* env var or an unconfigured
    // Razorpay account in this environment — surface the real message
    // (getPlanId/getAddonSeatPlanId already produce a specific, actionable
    // one) instead of letting it become an unhandled 500 with no JSON body.
    console.error("[razorpay/checkout] Failed to create order/subscription", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to start checkout" }, { status: 500 });
  }
}
