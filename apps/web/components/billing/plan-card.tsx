import { Check } from "lucide-react";
import { getEffectivePlan, getEffectivePrice, type PlanTier, type BillingInterval, type Currency, type PlanPriceOverrideMap, type PlanOverrideMap } from "@velobot/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", INR: "₹" };

export function PlanCard({
  tier,
  interval,
  currency,
  isCurrent,
  highlighted,
  cta,
  priceOverrides,
  planOverrides,
}: {
  tier: PlanTier;
  interval: BillingInterval;
  currency: Currency;
  isCurrent: boolean;
  highlighted?: boolean;
  cta: React.ReactNode;
  /** Super-Admin-edited prices from admin/pricing — omit to use the static defaults in plans.ts. */
  priceOverrides?: PlanPriceOverrideMap;
  /** Super-Admin-edited quotas/capabilities/features/badge from admin/pricing — omit to use the static defaults in plans.ts. */
  planOverrides?: PlanOverrideMap;
}) {
  const plan = getEffectivePlan(tier, planOverrides);
  const price = tier === "free" ? undefined : getEffectivePrice(tier, interval, currency, priceOverrides);

  return (
    <div
      className={cn(
        "relative flex flex-col gap-4 rounded-xl border p-6",
        highlighted ? "border-primary shadow-md ring-1 ring-primary" : "border-border"
      )}
    >
      {plan.badgeText && (
        <span className="absolute -top-3 right-4 rounded-full bg-destructive px-2.5 py-1 text-xs font-bold text-destructive-foreground shadow-sm">
          {plan.badgeText}
        </span>
      )}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{plan.name}</h3>
        {isCurrent && <Badge variant="success">Current plan</Badge>}
        {!isCurrent && highlighted && <Badge>Popular</Badge>}
      </div>

      <div className="flex items-baseline gap-1">
        {price === undefined ? (
          <span className="text-3xl font-bold">Free</span>
        ) : (
          <>
            <span className="text-3xl font-bold">
              {CURRENCY_SYMBOL[currency]}
              {price.toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground">/{interval === "monthly" ? "mo" : "yr"}</span>
          </>
        )}
      </div>

      <ul className="flex flex-1 flex-col gap-2 text-sm">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-status-good" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {cta}
    </div>
  );
}
