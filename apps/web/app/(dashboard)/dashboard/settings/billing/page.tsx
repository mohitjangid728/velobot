import { PAID_TIERS, type PlanTier, type BillingInterval, type Currency } from "@velobot/shared";
import { requireRole } from "@/lib/auth/session";
import { BillingPanel } from "@/components/dashboard/billing-panel";
import { getUsageSummary } from "@/lib/billing/usage";
import { getPlanPriceOverrides } from "@/lib/billing/plan-pricing";
import { getPlanOverrides } from "@/lib/billing/plan-overrides";
import type { CheckoutSessionInput } from "@velobot/shared";

function parseInitialCheckout(searchParams: {
  plan?: string;
  interval?: string;
  currency?: string;
}): CheckoutSessionInput | null {
  const tier = searchParams.plan;
  if (!tier || !PAID_TIERS.includes(tier as Exclude<PlanTier, "free">)) return null;
  const interval: BillingInterval = searchParams.interval === "yearly" ? "yearly" : "monthly";
  const currency: Currency = searchParams.currency === "INR" ? "INR" : "USD";
  return { kind: "plan", tier: tier as Exclude<PlanTier, "free">, interval, currency };
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { plan?: string; interval?: string; currency?: string };
}) {
  const { org } = await requireRole("admin");
  const [usage, priceOverrides, planOverrides] = await Promise.all([
    getUsageSummary(org),
    getPlanPriceOverrides(),
    getPlanOverrides(),
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-bold">Billing</h1>
      <BillingPanel
        org={org}
        usage={usage}
        priceOverrides={priceOverrides}
        planOverrides={planOverrides}
        initialCheckoutRequest={parseInitialCheckout(searchParams)}
      />
    </div>
  );
}
