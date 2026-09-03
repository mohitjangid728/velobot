import { describe, it, expect } from "vitest";
import { getEffectivePrice, priceOverrideKey, yearlyMonthsFree, PLANS } from "./plans";

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
