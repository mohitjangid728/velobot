import "server-only";
import type { BillingInterval, Currency, PlanTier } from "@velobot/shared";

/**
 * Razorpay Plan IDs are per-account, so they live in env vars rather than
 * packages/shared/src/plans.ts (which only holds account-agnostic
 * tier/quota/price *numbers*). Naming convention:
 *   RAZORPAY_PLAN_{TIER}_{INTERVAL}_{CURRENCY}   e.g. RAZORPAY_PLAN_HOBBY_MONTHLY_USD
 *   RAZORPAY_PLAN_ADDON_SEAT_{CURRENCY}
 * See .env.example for the full list, and
 * apps/web/scripts/create-razorpay-plans.mjs to generate the Plans (and
 * this env block) via the API instead of clicking through the dashboard.
 *
 * Unlike Stripe's price-map.ts, there's no reverse lookup here: every
 * Razorpay subscription this app creates is created by our own checkout
 * route (lib/razorpay/checkout below), which always stamps
 * notes:{org_id, kind, tier, interval, currency} — Razorpay has no hosted
 * customer-portal equivalent where a plan could change out from under us
 * with no app-supplied metadata to read back, so there's nothing to
 * reverse-resolve a bare plan_id into.
 *
 * The one-time `messages` addon needs no Plan at all — Razorpay Orders
 * take an inline amount, no pre-created price object.
 */
function envPlanId(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name} — see .env.example, or run scripts/create-razorpay-plans.mjs.`);
  return value;
}

export function getPlanId(tier: Exclude<PlanTier, "free">, interval: BillingInterval, currency: Currency): string {
  return envPlanId(`RAZORPAY_PLAN_${tier.toUpperCase()}_${interval.toUpperCase()}_${currency}`);
}

export function getAddonSeatPlanId(currency: Currency): string {
  return envPlanId(`RAZORPAY_PLAN_ADDON_SEAT_${currency}`);
}
