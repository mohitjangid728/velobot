"use client";

import { useState } from "react";
import { PAID_TIERS, BILLING_INTERVALS, CURRENCIES, PLANS, priceOverrideKey, type PlanPriceOverride, type PlanTier, type BillingInterval, type Currency } from "@velobot/shared";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", INR: "₹" };
const TIER_NAME: Record<Exclude<PlanTier, "free">, string> = { hobby: "Hobby", growth: "Growth", business: "Business" };

export function PricingEditor({ initialOverrides, canManage }: { initialOverrides: PlanPriceOverride[]; canManage: boolean }) {
  const [overrides, setOverrides] = useState<Record<string, PlanPriceOverride>>(() => {
    const map: Record<string, PlanPriceOverride> = {};
    for (const o of initialOverrides) map[priceOverrideKey(o.tier, o.interval, o.currency)] = o;
    return map;
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(tier: Exclude<PlanTier, "free">, interval: BillingInterval, currency: Currency) {
    const key = priceOverrideKey(tier, interval, currency);
    const draft = drafts[key];
    if (draft === undefined) return;
    const amount = Number(draft);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid non-negative amount.");
      return;
    }
    setSavingKey(key);
    setError(null);
    const res = await fetch("/api/admin/pricing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier, interval, currency, amount }),
    });
    const body = await res.json().catch(() => ({}));
    setSavingKey(null);
    if (!res.ok) {
      setError(body.error ?? "Failed to save price");
      return;
    }
    setOverrides((prev) => ({ ...prev, [key]: body.override }));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {PAID_TIERS.map((tier) => (
        <Card key={tier}>
          <CardHeader>
            <CardTitle className="text-base">{TIER_NAME[tier]}</CardTitle>
            <CardDescription>Static default shown in parentheses — leave blank to use it.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {BILLING_INTERVALS.map((interval) => (
              <div key={interval} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
                <span className="w-20 shrink-0 text-sm font-medium capitalize text-muted-foreground">{interval}</span>
                <div className="flex flex-1 flex-wrap gap-4">
                  {CURRENCIES.map((currency) => {
                    const key = priceOverrideKey(tier, interval, currency);
                    const override = overrides[key];
                    const staticDefault = PLANS[tier].pricing?.[interval][currency] ?? 0;
                    return (
                      <div key={currency} className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{CURRENCY_SYMBOL[currency]}</span>
                        <Input
                          className="w-28"
                          type="number"
                          min={0}
                          disabled={!canManage}
                          placeholder={String(staticDefault)}
                          value={drafts[key] ?? (override ? String(override.amount) : "")}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                        />
                        {override && <Badge variant="secondary">Override</Badge>}
                        {canManage && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={savingKey === key || drafts[key] === undefined}
                            onClick={() => save(tier, interval, currency)}
                          >
                            {savingKey === key ? "Saving..." : "Save"}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <p className="text-xs text-muted-foreground">
        Changing a price here updates what&apos;s displayed on the pricing page and the admin billing MRR calculation
        immediately. It does not change what Razorpay actually charges for existing or new subscriptions — that still
        follows the pre-created Razorpay Plan for each tier/interval/currency (see <code>RAZORPAY_PLAN_*</code> env vars),
        which needs a matching update once Razorpay Subscriptions is active on this account.
      </p>
    </div>
  );
}
