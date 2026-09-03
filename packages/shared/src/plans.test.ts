import { describe, it, expect } from "vitest";
import { getEffectivePrice, getEffectivePlan, priceOverrideKey, yearlyMonthsFree, PLANS } from "./plans";

describe("getEffectivePrice", () => {
  it("returns the static default when no override map is given", () => {
    expect(getEffectivePrice("hobby", "monthly", "USD")).toBe(PLANS.hobby.pricing!.monthly.USD);
  });

  it("returns the static default when the override map has no matching key", () => {
    const overrides = { [priceOverrideKey("growth", "monthly", "USD")]: 999 };
    expect(getEffectivePrice("hobby", "monthly", "USD", overrides)).toBe(PLANS.hobby.pricing!.monthly.USD);
  });

  it("returns the override when one exists for the exact tier/interval/currency", () => {
    const overrides = { [priceOverrideKey("hobby", "monthly", "USD")]: 25 };
    expect(getEffectivePrice("hobby", "monthly", "USD", overrides)).toBe(25);
  });

  it("treats a 0 override as a real value, not a fallback trigger", () => {
    const overrides = { [priceOverrideKey("hobby", "monthly", "USD")]: 0 };
    expect(getEffectivePrice("hobby", "monthly", "USD", overrides)).toBe(0);
  });
});

describe("yearlyMonthsFree", () => {
  it("matches the static pricing's built-in discount by default", () => {
    // hobby: monthly 19, yearly 190 -> 19*12=228, 228-190=38, 38/19=2 months free
    expect(yearlyMonthsFree("hobby", "USD")).toBe(2);
  });

  it("reflects an override on both monthly and yearly", () => {
    const overrides = {
      [priceOverrideKey("hobby", "monthly", "USD")]: 20,
      [priceOverrideKey("hobby", "yearly", "USD")]: 200,
    };
    // 20*12=240, 240-200=40, 40/20=2
    expect(yearlyMonthsFree("hobby", "USD", overrides)).toBe(2);
  });
});

describe("getEffectivePlan", () => {
  it("returns the static plan untouched when no overrides are given", () => {
    const plan = getEffectivePlan("hobby");
    expect(plan.quota).toEqual(PLANS.hobby.quota);
    expect(plan.capabilities).toEqual(PLANS.hobby.capabilities);
    expect(plan.features).toEqual(PLANS.hobby.features);
    expect(plan.badgeText).toBeNull();
  });

  it("merges a partial quota override, leaving the other quota fields at their static default", () => {
    const plan = getEffectivePlan("hobby", { hobby: { quota: { bots: 20 } } });
    expect(plan.quota.bots).toBe(20);
    expect(plan.quota.pages).toBe(PLANS.hobby.quota.pages);
    expect(plan.quota.messagesPerMonth).toBe(PLANS.hobby.quota.messagesPerMonth);
  });

  it("merges a partial capabilities override, leaving the other capability at its static default", () => {
    const plan = getEffectivePlan("hobby", { hobby: { capabilities: { apiAccess: true } } });
    expect(plan.capabilities.apiAccess).toBe(true);
    expect(plan.capabilities.removeBranding).toBe(PLANS.hobby.capabilities.removeBranding);
  });

  it("replaces features wholesale when overridden, not merged item-by-item", () => {
    const plan = getEffectivePlan("hobby", { hobby: { features: ["Custom feature"] } });
    expect(plan.features).toEqual(["Custom feature"]);
  });

  it("surfaces badgeText only when set, and only for the requested tier", () => {
    const overrides = { hobby: { badgeText: "20% OFF" } };
    expect(getEffectivePlan("hobby", overrides).badgeText).toBe("20% OFF");
    expect(getEffectivePlan("growth", overrides).badgeText).toBeNull();
  });

  it("leaves other tiers completely untouched by an override on one tier", () => {
    const overrides = { hobby: { quota: { bots: 999 } } };
    expect(getEffectivePlan("growth", overrides).quota).toEqual(PLANS.growth.quota);
  });
});
