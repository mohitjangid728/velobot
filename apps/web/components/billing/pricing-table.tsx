"use client";

import { useState } from "react";
import Link from "next/link";
import { PLAN_TIERS, PAID_TIERS, yearlyMonthsFree, type PlanTier, type BillingInterval, type Currency } from "@velobot/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlanCard } from "./plan-card";
import { cn } from "@/lib/utils";

const HIGHLIGHTED_TIER: Exclude<PlanTier, "free"> = "growth";

export function PricingTable({
  defaultCurrency = "USD",
  currentTier,
  mode,
  onSelectPlan,
}: {
  defaultCurrency?: Currency;
  /** Marks a tier's card as "Current plan" and disables its own CTA — omit on the logged-out public page. */
  currentTier?: PlanTier;
  /** "link" sends CTAs to /signup (logged-out, public page). "checkout" invokes onSelectPlan (logged-in dashboard). */
  mode: "link" | "checkout";
  onSelectPlan?: (tier: Exclude<PlanTier, "free">, interval: BillingInterval, currency: Currency) => void;
}) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);

  const monthsFree = yearlyMonthsFree(HIGHLIGHTED_TIER, currency);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-center gap-4">
        <div className="inline-flex rounded-lg border bg-muted p-1">
          {(["monthly", "yearly"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setInterval(opt)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                interval === opt ? "bg-background shadow-sm" : "text-muted-foreground"
              )}
            >
              {opt === "monthly" ? "Monthly" : "Yearly"}
              {opt === "yearly" && monthsFree > 0 && (
                <Badge variant="success" className="ml-2">
                  {monthsFree} months free
                </Badge>
              )}
            </button>
          ))}
        </div>

        <div className="inline-flex rounded-lg border bg-muted p-1">
          {(["USD", "INR"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setCurrency(opt)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                currency === opt ? "bg-background shadow-sm" : "text-muted-foreground"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLAN_TIERS.map((tier) => {
          const isCurrent = currentTier === tier;
          const isPaid = (PAID_TIERS as string[]).includes(tier);

          let cta: React.ReactNode;
          if (isCurrent) {
            cta = (
              <Button disabled className="w-full">
                Current plan
              </Button>
            );
          } else if (tier === "free") {
            cta = mode === "link" ? (
              <Button asChild variant="outline" className="w-full">
                <Link href="/signup">Get started</Link>
              </Button>
            ) : (
              <Button disabled variant="outline" className="w-full">
                Downgrade via support
              </Button>
            );
          } else if (mode === "link") {
            cta = (
              <Button asChild className="w-full" variant={tier === HIGHLIGHTED_TIER ? "default" : "outline"}>
                <Link href={`/signup?plan=${tier}&interval=${interval}`}>Get started</Link>
              </Button>
            );
          } else {
            cta = (
              <Button
                className="w-full"
                variant={tier === HIGHLIGHTED_TIER ? "default" : "outline"}
                onClick={() => isPaid && onSelectPlan?.(tier as Exclude<PlanTier, "free">, interval, currency)}
              >
                {currentTier && currentTier !== "free" ? "Switch plan" : "Upgrade"}
              </Button>
            );
          }

          return (
            <PlanCard
              key={tier}
              tier={tier}
              interval={interval}
              currency={currency}
              isCurrent={isCurrent}
              highlighted={tier === HIGHLIGHTED_TIER}
              cta={cta}
            />
          );
        })}
      </div>
    </div>
  );
}
