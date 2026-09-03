import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Coupon, CouponAppliesTo } from "@velobot/shared";

export type PurchaseKind = Extract<CouponAppliesTo, "messages_addon" | "plan_subscription">;

export interface CouponValidation {
  coupon: Coupon;
  /** Whole-currency-unit amount actually charged after the discount (never below 0). */
  discountedAmount: number;
  amountDiscounted: number;
}

/**
 * Validates a coupon code for one purchase and computes the discounted
 * amount. Does NOT record a redemption — that happens once payment is
 * actually confirmed, from the same idempotent success path as
 * applyPlanActivation/applyAddonMessagesCredit (see recordRedemption
 * below), so a code that fails payment or gets abandoned mid-checkout
 * never counts against max_redemptions.
 */
export async function validateCoupon(
  code: string,
  purchaseKind: PurchaseKind,
  orgId: string,
  originalAmount: number
): Promise<{ ok: true; validation: CouponValidation } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  const { data: coupon } = await admin
    .from("coupons")
    .select("*")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();

  if (!coupon) return { ok: false, error: "Invalid coupon code" };
  const c = coupon as Coupon;

  if (!c.is_active) return { ok: false, error: "This coupon is no longer active" };
  if (c.expires_at && new Date(c.expires_at) < new Date()) return { ok: false, error: "This coupon has expired" };
  if (c.max_redemptions !== null && c.times_redeemed >= c.max_redemptions) {
    return { ok: false, error: "This coupon has reached its redemption limit" };
  }
  if (c.applies_to !== "all" && c.applies_to !== purchaseKind) {
    return { ok: false, error: "This coupon doesn't apply to this purchase" };
  }
  if (purchaseKind === "plan_subscription" && !c.razorpay_offer_id) {
    // Shouldn't happen if CreateCouponSchema's refine was enforced at
    // creation time, but a coupon row could predate that constraint.
    return { ok: false, error: "This coupon isn't configured for subscription purchases" };
  }

  const { data: existingRedemption } = await admin
    .from("coupon_redemptions")
    .select("id")
    .eq("coupon_id", c.id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (existingRedemption) return { ok: false, error: "You've already used this coupon" };

  const amountDiscounted =
    c.discount_type === "percent" ? Math.round((originalAmount * c.discount_value) / 100) : Math.round(c.discount_value);
  const discountedAmount = Math.max(0, originalAmount - amountDiscounted);

  return { ok: true, validation: { coupon: c, discountedAmount, amountDiscounted: originalAmount - discountedAmount } };
}

/** Called from the verify/webhook success path once, guarded by the same idempotency table those routes already use — never called twice for the same payment. */
export async function recordRedemption(input: {
  couponId: string;
  orgId: string;
  purchaseKind: PurchaseKind;
  amountDiscounted: number;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("coupon_redemptions").insert({
    coupon_id: input.couponId,
    org_id: input.orgId,
    purchase_kind: input.purchaseKind,
    amount_discounted: input.amountDiscounted,
  });
  if (error) {
    console.error("Failed to record coupon redemption:", error.message, input);
    return;
  }
  // Best-effort increment — a lost update here under concurrent redemptions
  // of the same coupon would only let max_redemptions be exceeded by a
  // handful of requests in the same instant, not an unbounded amount.
  const { data: coupon } = await admin.from("coupons").select("times_redeemed").eq("id", input.couponId).maybeSingle();
  if (coupon) {
    await admin
      .from("coupons")
      .update({ times_redeemed: (coupon.times_redeemed as number) + 1 })
      .eq("id", input.couponId);
  }
}

export async function findCouponByCode(code: string): Promise<Coupon | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("coupons").select("*").eq("code", code.trim().toUpperCase()).maybeSingle();
  return (data as Coupon | null) ?? null;
}
