import { NextResponse } from "next/server";
import { ROLE_RANK, CheckoutSessionSchema, ADDONS, getEffectivePrice } from "@velobot/shared";
import { getActiveOrg } from "@/lib/auth/session";
import { getRazorpayClient } from "@/lib/razorpay/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPlanPriceOverrides } from "@/lib/billing/plan-pricing";
import { validateCoupon } from "@/lib/billing/coupons";

/**
 * Replaces stripe/checkout-session/route.ts. Plan and seat-addon purchases
 * go out as Razorpay Payment Links (a hosted page we redirect the browser
 * to) rather than Subscriptions — Subscriptions require a separate
 * "Subscriptions" activation on the Razorpay account that isn't available
 * here, while Payment Links work with the same basic Payments capability
 * as Orders. This means these are one-time charges, not auto-renewing:
 * see applyPlanActivation's caller in webhook/route.ts for how the paid
 * period's end date is computed, and its doc comment for what this does
 * and doesn't do about renewal. The messages add-on already used a plain
 * Order (no Plans/Subscriptions needed) and is unchanged.
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

    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing`;

    if (parsed.data.kind === "plan") {
      const { tier, interval, currency, couponCode } = parsed.data;
      const overrides = await getPlanPriceOverrides();
      let amount = getEffectivePrice(tier, interval, currency, overrides);
      if (amount === undefined) {
        return NextResponse.json({ error: "This plan has no price configured for that currency/interval" }, { status: 400 });
      }

      const couponNotes: Record<string, string | number> = {};
      if (couponCode) {
        const result = await validateCoupon(couponCode, "plan_subscription", org.id, amount);
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
        amount = result.validation.discountedAmount;
        couponNotes.couponId = result.validation.coupon.id;
        couponNotes.couponCode = result.validation.coupon.code;
        couponNotes.amountDiscounted = result.validation.amountDiscounted;
      }

      const paymentLink = await razorpay.paymentLink.create({
        amount: Math.round(amount * 100),
        currency,
        description: `VeloBot ${tier} plan (${interval})`,
        customer: { name: org.name, email: user.email ?? "" },
        notify: { email: true, sms: false },
        callback_url: callbackUrl,
        callback_method: "get",
        notes: { org_id: org.id, kind: "plan", tier, interval, currency, ...couponNotes },
      });
      return NextResponse.json({ paymentLinkUrl: paymentLink.short_url });
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

    let seatAmount = ADDONS.seat.price[currency] * quantity;
    const couponNotes: Record<string, string | number> = {};
    if (couponCode) {
      const result = await validateCoupon(couponCode, "plan_subscription", org.id, seatAmount);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      seatAmount = result.validation.discountedAmount;
      couponNotes.couponId = result.validation.coupon.id;
      couponNotes.couponCode = result.validation.coupon.code;
      couponNotes.amountDiscounted = result.validation.amountDiscounted;
    }
    const paymentLink = await razorpay.paymentLink.create({
      amount: Math.round(seatAmount * 100),
      currency,
      description: `VeloBot extra agent seat x${quantity}`,
      customer: { name: org.name, email: user.email ?? "" },
      notify: { email: true, sms: false },
      callback_url: callbackUrl,
      callback_method: "get",
      notes: { org_id: org.id, kind: "addon_seat", quantity, ...couponNotes },
    });
    return NextResponse.json({ paymentLinkUrl: paymentLink.short_url });
  } catch (err) {
    console.error("[razorpay/checkout] Failed to create order/payment link", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to start checkout" }, { status: 500 });
  }
}
