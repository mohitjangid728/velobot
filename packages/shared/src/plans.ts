/**
 * Single source of truth for pricing/quotas — consumed by the pricing page,
 * checkout, the Razorpay webhook, and the server-side quota guards
 * (lib/billing/guards.ts). Razorpay Plan IDs are NOT here (they're
 * per-account) — see lib/razorpay/plan-map.ts, which maps
 * (tier, interval, currency) to an env-var-configured plan id using the
 * tier/interval/currency vocabulary defined in this file.
 */

export type PlanTier = "free" | "hobby" | "growth" | "business";
export type BillingInterval = "monthly" | "yearly";
export type Currency = "USD" | "INR";

export const PLAN_TIERS: PlanTier[] = ["free", "hobby", "growth", "business"];
export const PAID_TIERS: Exclude<PlanTier, "free">[] = ["hobby", "growth", "business"];
export const BILLING_INTERVALS: BillingInterval[] = ["monthly", "yearly"];
export const CURRENCIES: Currency[] = ["USD", "INR"];

export interface PlanQuota {
  bots: number;
  pages: number;
  messagesPerMonth: number;
  agentSeats: number;
}

/** Boolean feature gates — unlike PlanQuota's numeric limits, these are on/off. Read at call time via PLANS[org.plan].capabilities, never persisted per-org (see lib/billing/guards.ts). */
export interface PlanCapabilities {
  /** Hides "Powered by VeloBot" in the widget when the bot's own branding_removed toggle is also on. */
  removeBranding: boolean;
  /** Enables issuing keys for the public Developer API (see docs/API.md). */
  apiAccess: boolean;
}

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  quota: PlanQuota;
  capabilities: PlanCapabilities;
  /** Marketing bullets for the pricing page — not consumed by any guard logic. */
  features: string[];
  /** null for the free tier, which has no checkout. */
  pricing: Record<BillingInterval, Record<Currency, number>> | null;
}

export const PLANS: Record<PlanTier, PlanDefinition> = {
  free: {
    tier: "free",
    name: "Free",
    quota: { bots: 1, pages: 20, messagesPerMonth: 50, agentSeats: 1 },
    capabilities: { removeBranding: false, apiAccess: false },
    features: ["1 bot", "20 pages indexed", "50 AI messages/mo", "Community support"],
    pricing: null,
  },
  hobby: {
    tier: "hobby",
    name: "Hobby",
    quota: { bots: 2, pages: 200, messagesPerMonth: 1500, agentSeats: 1 },
    capabilities: { removeBranding: false, apiAccess: false },
    features: ["2 bots", "200 pages indexed", "1,500 AI messages/mo", "1 agent seat", "Email support"],
    pricing: {
      monthly: { USD: 19, INR: 999 },
      yearly: { USD: 190, INR: 9990 },
    },
  },
  growth: {
    tier: "growth",
    name: "Growth",
    quota: { bots: 5, pages: 1000, messagesPerMonth: 5000, agentSeats: 3 },
    capabilities: { removeBranding: false, apiAccess: false },
    features: [
      "5 bots",
      "1,000 pages indexed",
      "5,000 AI messages/mo",
      "3 agent seats",
      "Auto-sync crawler",
      "Priority support",
    ],
    pricing: {
      monthly: { USD: 49, INR: 2499 },
      yearly: { USD: 490, INR: 24990 },
    },
  },
  business: {
    tier: "business",
    name: "Business",
    quota: { bots: 15, pages: 5000, messagesPerMonth: 20000, agentSeats: 10 },
    capabilities: { removeBranding: true, apiAccess: true },
    features: [
      "15 bots",
      "5,000 pages indexed",
      "20,000 AI messages/mo",
      "10 agent seats",
      "Team RBAC",
      "Full API access",
      "Remove VeloBot branding",
      "Priority support",
    ],
    pricing: {
      monthly: { USD: 149, INR: 7999 },
      yearly: { USD: 1490, INR: 79990 },
    },
  },
};

export interface AddonDefinition {
  /** Units credited per purchase — e.g. buying "messages" once credits 1000 messages. */
  amount: number;
  price: Record<Currency, number>;
  /** Whether this add-on is a recurring monthly subscription item or a one-time purchase. */
  recurring: boolean;
}

export const ADDONS: { messages: AddonDefinition; seat: AddonDefinition } = {
  messages: { amount: 1000, price: { USD: 10, INR: 499 }, recurring: false },
  seat: { amount: 1, price: { USD: 10, INR: 499 }, recurring: true },
};

/** Yearly is priced at 10x monthly (2 months free) for every paid tier — used by the pricing UI's "2 months free" badge math. */
export function yearlyMonthsFree(tier: Exclude<PlanTier, "free">, currency: Currency): number {
  const plan = PLANS[tier];
  if (!plan.pricing) return 0;
  const monthly = plan.pricing.monthly[currency];
  const yearly = plan.pricing.yearly[currency];
  if (!monthly) return 0;
  return Math.round((monthly * 12 - yearly) / monthly);
}
