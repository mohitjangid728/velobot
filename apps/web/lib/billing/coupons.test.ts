import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeMockAdminClient, makeQueryResult } from "@/lib/test-utils/mock-supabase-admin";
import type { Coupon } from "@velobot/shared";

const mockAdmin = vi.hoisted(() => ({ client: null as ReturnType<typeof makeMockAdminClient> | null }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => mockAdmin.client }));

import { validateCoupon } from "./coupons";

const BASE_COUPON: Coupon = {
  id: "coupon-1",
  code: "LAUNCH20",
  discount_type: "percent",
  discount_value: 20,
  applies_to: "messages_addon",
  razorpay_offer_id: null,
  currency: null,
  max_redemptions: null,
  times_redeemed: 0,
  expires_at: null,
  is_active: true,
  created_by: "admin-1",
  created_at: "2026-01-01T00:00:00.000Z",
};

function setupClient(coupon: Coupon | null, existingRedemption: { id: string } | null = null) {
  mockAdmin.client = makeMockAdminClient({
    coupons: makeQueryResult({ data: coupon, error: null }),
    coupon_redemptions: makeQueryResult({ data: existingRedemption, error: null }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateCoupon", () => {
  it("rejects an unknown code", async () => {
    setupClient(null);
    const result = await validateCoupon("NOPE", "messages_addon", "org-1", 100, "USD");
    expect(result).toEqual({ ok: false, error: "Invalid coupon code" });
  });

  it("rejects an inactive coupon", async () => {
    setupClient({ ...BASE_COUPON, is_active: false });
    const result = await validateCoupon("LAUNCH20", "messages_addon", "org-1", 100, "USD");
    expect(result.ok).toBe(false);
  });

  it("rejects an expired coupon", async () => {
    setupClient({ ...BASE_COUPON, expires_at: "2020-01-01T00:00:00.000Z" });
    const result = await validateCoupon("LAUNCH20", "messages_addon", "org-1", 100, "USD");
    expect(result.ok).toBe(false);
  });

  it("rejects a coupon that has hit its redemption limit", async () => {
    setupClient({ ...BASE_COUPON, max_redemptions: 5, times_redeemed: 5 });
    const result = await validateCoupon("LAUNCH20", "messages_addon", "org-1", 100, "USD");
    expect(result.ok).toBe(false);
  });

  it("rejects a purchase kind the coupon doesn't apply to", async () => {
    setupClient({ ...BASE_COUPON, applies_to: "plan_subscription" });
    const result = await validateCoupon("LAUNCH20", "messages_addon", "org-1", 100, "USD");
    expect(result.ok).toBe(false);
  });

  it("accepts a plan_subscription coupon with no razorpay_offer_id — plan/seat purchases are plain Orders, not Subscriptions, so no Razorpay Offer is ever involved", async () => {
    setupClient({ ...BASE_COUPON, applies_to: "plan_subscription", razorpay_offer_id: null });
    const result = await validateCoupon("LAUNCH20", "plan_subscription", "org-1", 100, "USD");
    expect(result.ok).toBe(true);
  });

  it("rejects an org that already redeemed this coupon", async () => {
    setupClient(BASE_COUPON, { id: "redemption-1" });
    const result = await validateCoupon("LAUNCH20", "messages_addon", "org-1", 100, "USD");
    expect(result.ok).toBe(false);
  });

  it("computes a percent discount correctly", async () => {
    setupClient(BASE_COUPON);
    const result = await validateCoupon("LAUNCH20", "messages_addon", "org-1", 100, "USD");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.validation.discountedAmount).toBe(80);
      expect(result.validation.amountDiscounted).toBe(20);
      expect(result.validation.isFullyDiscounted).toBe(false);
    }
  });

  it("ignores currency entirely for a percent coupon — 20% off is 20% off in any currency", async () => {
    setupClient(BASE_COUPON);
    const result = await validateCoupon("LAUNCH20", "messages_addon", "org-1", 100, "INR");
    expect(result.ok).toBe(true);
  });

  it("computes a fixed discount correctly and clamps at 0", async () => {
    setupClient({ ...BASE_COUPON, discount_type: "fixed", discount_value: 30, currency: "USD" });
    const result = await validateCoupon("LAUNCH20", "messages_addon", "org-1", 10, "USD");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.validation.discountedAmount).toBe(0);
      expect(result.validation.amountDiscounted).toBe(10);
      expect(result.validation.isFullyDiscounted).toBe(true);
    }
  });

  it("rejects a fixed coupon when the purchase currency doesn't match — '$10 off' isn't '₹10 off'", async () => {
    setupClient({ ...BASE_COUPON, discount_type: "fixed", discount_value: 10, currency: "USD" });
    const result = await validateCoupon("LAUNCH20", "messages_addon", "org-1", 100, "INR");
    expect(result).toEqual({ ok: false, error: "This coupon only applies to USD purchases" });
  });

  it("accepts applies_to: all for any purchase kind", async () => {
    setupClient({ ...BASE_COUPON, applies_to: "all" });
    const result = await validateCoupon("LAUNCH20", "messages_addon", "org-1", 100, "USD");
    expect(result.ok).toBe(true);
  });
});
