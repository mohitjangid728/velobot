import { Check } from "lucide-react";
import { PLANS, type PlanTier, type BillingInterval, type Currency } from "@velobot/shared";
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
}: {
  tier: PlanTier;
  interval: BillingInterval;
  currency: Currency;
  isCurrent: boolean;
  highlighted?: boolean;
  cta: React.ReactNode;
}) {
  const plan = PLANS[tier];
  const price = plan.pricing?.[interval][currency];

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border p-6",
        highlighted ? "border-primary shadow-md ring-1 ring-primary" : "border-border"
      )}
    >
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
