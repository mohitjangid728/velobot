import { describe, it, expect } from "vitest";
import { isWithinBusinessHours } from "./business-hours";
import type { BusinessHours } from "@velobot/shared";

const hours: BusinessHours = {
  timezone: "UTC",
  days: {
    mon: { open: "09:00", close: "17:00" },
    tue: { open: "09:00", close: "17:00" },
    wed: { open: "09:00", close: "17:00" },
    thu: { open: "09:00", close: "17:00" },
    fri: { open: "09:00", close: "17:00" },
    sat: null,
    sun: null,
  },
};

describe("isWithinBusinessHours", () => {
  it("is always available when the bot has no configured hours", () => {
    expect(isWithinBusinessHours(null)).toBe(true);
  });

  it("is open during a configured weekday window", () => {
    // Wednesday 12:00 UTC
    expect(isWithinBusinessHours(hours, new Date("2026-08-19T12:00:00Z"))).toBe(true);
  });

  it("is closed before the opening time", () => {
    // Wednesday 08:00 UTC
    expect(isWithinBusinessHours(hours, new Date("2026-08-19T08:00:00Z"))).toBe(false);
  });

  it("is closed after the closing time", () => {
    // Wednesday 18:00 UTC
    expect(isWithinBusinessHours(hours, new Date("2026-08-19T18:00:00Z"))).toBe(false);
  });

  it("is closed on a day with no configured hours", () => {
    // Saturday 12:00 UTC
    expect(isWithinBusinessHours(hours, new Date("2026-08-22T12:00:00Z"))).toBe(false);
  });

  it("fails open on an unrecognized timezone rather than 500ing the widget-config route", () => {
    const bad: BusinessHours = { ...hours, timezone: "Not/A_Real_Zone" };
    expect(isWithinBusinessHours(bad, new Date("2026-08-19T12:00:00Z"))).toBe(true);
  });
});
