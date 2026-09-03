"use client";

import { useState } from "react";
import {
  PLAN_TIERS,
  PAID_TIERS,
  BILLING_INTERVALS,
  CURRENCIES,
  PLANS,
  priceOverrideKey,
  type PlanPriceOverride,
  type PlanOverride,
  type PlanTier,
  type Currency,
} from "@velobot/shared";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", INR: "₹" };
const TIER_NAME: Record<PlanTier, string> = { free: "Free", hobby: "Hobby", growth: "Growth", business: "Business" };

function emptyOverride(tier: PlanTier): PlanOverride {
  return {
    tier,
    quota_bots: null,
    quota_pages: null,
    quota_messages_per_month: null,
    quota_agent_seats: null,
    capability_remove_branding: null,
    capability_api_access: null,
    features: null,
    badge_text: null,
    updated_by: "",
    updated_at: "",
  };
}

export function PlanEditor({
  initialPriceOverrides,
  initialPlanOverrides,
  canManage,
}: {
  initialPriceOverrides: PlanPriceOverride[];
  initialPlanOverrides: PlanOverride[];
  canManage: boolean;
}) {
  const [priceOverrides, setPriceOverrides] = useState<Record<string, PlanPriceOverride>>(() => {
    const map: Record<string, PlanPriceOverride> = {};
    for (const o of initialPriceOverrides) map[priceOverrideKey(o.tier, o.interval, o.currency)] = o;
    return map;
  });
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [savingPriceKey, setSavingPriceKey] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);

  const [planOverrides, setPlanOverrides] = useState<Record<PlanTier, PlanOverride>>(() => {
    const map = Object.fromEntries(PLAN_TIERS.map((t) => [t, emptyOverride(t)])) as Record<PlanTier, PlanOverride>;
    for (const o of initialPlanOverrides) map[o.tier] = o;
    return map;
  });
  // Features editors work on raw textarea text (one bullet per line) rather than the array directly, so a mid-edit blank line doesn't get silently dropped.
  const [featuresDrafts, setFeaturesDrafts] = useState<Record<string, string>>({});
  const [savingTier, setSavingTier] = useState<PlanTier | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  async function savePrice(tier: Exclude<PlanTier, "free">, interval: (typeof BILLING_INTERVALS)[number], currency: Currency) {
    const key = priceOverrideKey(tier, interval, currency);
    const draft = priceDrafts[key];
    if (draft === undefined) return;
    const amount = Number(draft);
    if (!Number.isFinite(amount) || amount < 0) {
      setPriceError("Enter a valid non-negative amount.");
      return;
    }
    setSavingPriceKey(key);
    setPriceError(null);
    const res = await fetch("/api/admin/pricing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier, interval, currency, amount }),
    });
    const body = await res.json().catch(() => ({}));
    setSavingPriceKey(null);
    if (!res.ok) {
      setPriceError(body.error ?? "Failed to save price");
      return;
    }
    setPriceOverrides((prev) => ({ ...prev, [key]: body.override }));
    setPriceDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function updateDraftPlan(tier: PlanTier, fields: Partial<PlanOverride>) {
    setPlanOverrides((prev) => ({ ...prev, [tier]: { ...prev[tier], ...fields } }));
  }

  async function savePlanDetails(tier: PlanTier) {
    const o = planOverrides[tier];
    const featuresDraft = featuresDrafts[tier];
    const features =
      featuresDraft !== undefined
        ? featuresDraft
            .split("\n")
            .map((f) => f.trim())
            .filter(Boolean)
        : o.features;

    setSavingTier(tier);
    setPlanError(null);
    const res = await fetch(`/api/admin/plans/${tier}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quota_bots: o.quota_bots,
        quota_pages: o.quota_pages,
        quota_messages_per_month: o.quota_messages_per_month,
        quota_agent_seats: o.quota_agent_seats,
        capability_remove_branding: o.capability_remove_branding,
        capability_api_access: o.capability_api_access,
        features,
        badge_text: o.badge_text,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSavingTier(null);
    if (!res.ok) {
      setPlanError(typeof body.error === "string" ? body.error : "Failed to save plan details");
      return;
    }
    setPlanOverrides((prev) => ({ ...prev, [tier]: body.override }));
    setFeaturesDrafts((prev) => {
      const next = { ...prev };
      delete next[tier];
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {(priceError || planError) && <p className="text-sm text-destructive">{priceError ?? planError}</p>}

      {PLAN_TIERS.map((tier) => {
        const isPaid = (PAID_TIERS as string[]).includes(tier);
        const o = planOverrides[tier];
        const staticDefault = PLANS[tier];
        const hasOverride =
          o.quota_bots !== null ||
          o.quota_pages !== null ||
          o.quota_messages_per_month !== null ||
          o.quota_agent_seats !== null ||
          o.capability_remove_branding !== null ||
          o.capability_api_access !== null ||
          o.features !== null ||
          o.badge_text !== null;

        return (
          <Card key={tier}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{TIER_NAME[tier]}</CardTitle>
                {hasOverride && <Badge variant="secondary">Customized</Badge>}
              </div>
              <CardDescription>Blank fields fall back to the static default shown as a placeholder.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {isPaid && (
                <div className="flex flex-col gap-3">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pricing</Label>
                  {BILLING_INTERVALS.map((interval) => (
                    <div key={interval} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
                      <span className="w-20 shrink-0 text-sm font-medium capitalize text-muted-foreground">{interval}</span>
                      <div className="flex flex-1 flex-wrap gap-4">
                        {CURRENCIES.map((currency) => {
                          const key = priceOverrideKey(tier as Exclude<PlanTier, "free">, interval, currency);
                          const override = priceOverrides[key];
                          const defaultAmount = staticDefault.pricing?.[interval][currency] ?? 0;
                          return (
                            <div key={currency} className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">{CURRENCY_SYMBOL[currency]}</span>
                              <Input
                                className="w-28"
                                type="number"
                                min={0}
                                disabled={!canManage}
                                placeholder={String(defaultAmount)}
                                value={priceDrafts[key] ?? (override ? String(override.amount) : "")}
                                onChange={(e) => setPriceDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                              />
                              {canManage && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={savingPriceKey === key || priceDrafts[key] === undefined}
                                  onClick={() => savePrice(tier as Exclude<PlanTier, "free">, interval, currency)}
                                >
                                  {savingPriceKey === key ? "Saving..." : "Save"}
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quotas</Label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(
                    [
                      ["quota_bots", "Bots", staticDefault.quota.bots],
                      ["quota_pages", "Pages", staticDefault.quota.pages],
                      ["quota_messages_per_month", "Messages/mo", staticDefault.quota.messagesPerMonth],
                      ["quota_agent_seats", "Agent seats", staticDefault.quota.agentSeats],
                    ] as const
                  ).map(([field, label, defaultValue]) => (
                    <div key={field} className="flex flex-col gap-1.5">
                      <Label htmlFor={`${tier}-${field}`} className="text-xs">
                        {label}
                      </Label>
                      <Input
                        id={`${tier}-${field}`}
                        type="number"
                        min={0}
                        disabled={!canManage}
                        placeholder={String(defaultValue)}
                        value={o[field] ?? ""}
                        onChange={(e) => updateDraftPlan(tier, { [field]: e.target.value === "" ? null : Number(e.target.value) })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Capabilities</Label>
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-8">
                  <div className="flex items-center gap-2">
                    <Switch
                      disabled={!canManage}
                      checked={o.capability_remove_branding ?? staticDefault.capabilities.removeBranding}
                      onCheckedChange={(checked) => updateDraftPlan(tier, { capability_remove_branding: checked })}
                    />
                    <Label className="text-sm font-normal">Remove branding</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      disabled={!canManage}
                      checked={o.capability_api_access ?? staticDefault.capabilities.apiAccess}
                      onCheckedChange={(checked) => updateDraftPlan(tier, { capability_api_access: checked })}
                    />
                    <Label className="text-sm font-normal">Developer API access</Label>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${tier}-features`} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Features (one per line, shown on the pricing card)
                </Label>
                <Textarea
                  id={`${tier}-features`}
                  rows={5}
                  disabled={!canManage}
                  placeholder={staticDefault.features.join("\n")}
                  value={featuresDrafts[tier] ?? (o.features ?? []).join("\n")}
                  onChange={(e) => setFeaturesDrafts((prev) => ({ ...prev, [tier]: e.target.value }))}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${tier}-badge`} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Promotional badge (optional — shown as a ribbon on the pricing card)
                </Label>
                <Input
                  id={`${tier}-badge`}
                  disabled={!canManage}
                  placeholder="e.g. 20% OFF"
                  maxLength={40}
                  value={o.badge_text ?? ""}
                  onChange={(e) => updateDraftPlan(tier, { badge_text: e.target.value || null })}
                />
              </div>

              {canManage && (
                <Button onClick={() => savePlanDetails(tier)} disabled={savingTier === tier} className="w-fit">
                  {savingTier === tier ? "Saving..." : "Save plan details"}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}

      <p className="text-xs text-muted-foreground">
        Changing a price updates what&apos;s displayed on the pricing page and the admin billing MRR calculation
        immediately. It does not change what Razorpay actually charges for existing or new subscriptions — that still
        follows the pre-created Razorpay Plan for each tier/interval/currency (see <code>RAZORPAY_PLAN_*</code> env vars),
        which needs a matching update once Razorpay Subscriptions is active on this account. Quota and capability
        changes take effect immediately everywhere they&apos;re enforced (bot/page/message/seat limits, API access,
        branding removal).
      </p>
    </div>
  );
}
