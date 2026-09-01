import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getPlanId, getAddonSeatPlanId } from "./plan-map";

describe("getPlanId", () => {
  afterEach(() => {
    delete process.env.RAZORPAY_PLAN_HOBBY_MONTHLY_USD;
  });

  it("throws a specific, actionable error when the env var is missing", () => {
    expect(() => getPlanId("hobby", "monthly", "USD")).toThrow(/RAZORPAY_PLAN_HOBBY_MONTHLY_USD/);
  });

  it("returns the configured plan id", () => {
    process.env.RAZORPAY_PLAN_HOBBY_MONTHLY_USD = "plan_test123";
    expect(getPlanId("hobby", "monthly", "USD")).toBe("plan_test123");
  });
});

describe("getAddonSeatPlanId", () => {
  beforeEach(() => {
    delete process.env.RAZORPAY_PLAN_ADDON_SEAT_INR;
  });

  it("throws when unset", () => {
    expect(() => getAddonSeatPlanId("INR")).toThrow(/RAZORPAY_PLAN_ADDON_SEAT_INR/);
  });

  it("returns the configured plan id", () => {
    process.env.RAZORPAY_PLAN_ADDON_SEAT_INR = "plan_seat_inr";
    expect(getAddonSeatPlanId("INR")).toBe("plan_seat_inr");
  });
});
