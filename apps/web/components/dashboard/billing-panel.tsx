"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Sparkles, Crown } from "lucide-react";
import { getEffectivePlan, type Organization, type PlanTier, type BillingInterval, type Currency, type PlanPriceOverrideMap, type PlanOverrideMap } from "@velobot/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PricingTable } from "@/components/billing/pricing-table";
import { CheckoutModal } from "@/components/billing/checkout-modal";
import { AddonModal } from "@/components/billing/addon-modal";
import { ManageSubscriptionPanel } from "@/components/dashboard/manage-subscription-panel";
import { CouponField } from "@/components/billing/coupon-field";
import type { CheckoutSessionInput } from "@velobot/shared";
import type { UsageSummary } from "@/lib/billing/usage";

export function quotaTone(used: number, limit: number): "default" | "warning" | "critical" {
  const pct = limit > 0 ? used / limit : 0;
  if (pct >= 1) return "critical";
  if (pct >= 0.8) return "warning";
  return "default";
}

export function QuotaBar({ label, used, limit, extra }: { label: string; used: number; limit: number; extra?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {used.toLocaleString()} / {limit.toLocaleString()}
          {extra && <span className="ml-1 text-muted-foreground">{extra}</span>}
        </span>
      </div>
      <Progress value={(used / limit) * 100} tone={quotaTone(used, limit)} />
    </div>
  );
}

export function BillingPanel({
  org,
  usage,
  priceOverrides,
  planOverrides,
  initialCheckoutRequest,
}: {
  org: Organization;
  usage: UsageSummary;
  priceOverrides?: PlanPriceOverrideMap;
  planOverrides?: PlanOverrideMap;
  /** Carried from the pricing page via signup/onboarding's query string — opens Checkout immediately instead of landing on Free. */
  initialCheckoutRequest?: CheckoutSessionInput | null;
}) {
  const [pricingOpen, setPricingOpen] = useState(false);
  const [checkoutRequest, setCheckoutRequest] = useState<CheckoutSessionInput | null>(initialCheckoutRequest ?? null);
  const [addonOpen, setAddonOpen] = useState<"messages" | "seat" | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);

  const plan = getEffectivePlan(org.plan, planOverrides);
  const messageLimit = plan.quota.messagesPerMonth + org.addon_message_balance;
  const hasAddons = org.addon_message_balance > 0 || org.addon_seats > 0;

  function handleSelectPlan(tier: Exclude<PlanTier, "free">, interval: BillingInterval, currency: Currency) {
    setPricingOpen(false);
    setCheckoutRequest({
      kind: "plan",
      tier,
      interval,
      currency,
      ...(appliedCoupon ? { couponCode: appliedCoupon } : {}),
    });
    setAppliedCoupon(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className={org.plan !== "free" ? "border-primary/25 bg-gradient-to-br from-primary/[0.04] to-transparent" : undefined}>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              {org.plan !== "free" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Crown className="h-4 w-4 text-primary" />
                </div>
              )}
              <CardTitle>{plan.name} plan</CardTitle>
              <Badge variant={org.plan === "free" ? "secondary" : "success"}>
                {org.billing_interval === "yearly" ? "Yearly" : org.plan === "free" ? "Free" : "Monthly"}
              </Badge>
              {org.payment_status === "past_due" && <Badge variant="serious">Payment failed</Badge>}
            </div>
            <span className="text-xs text-muted-foreground">
              {org.current_period_start && org.current_period_end
                ? `Current period: ${format(new Date(org.current_period_start), "MMM d")} – ${format(new Date(org.current_period_end), "MMM d, yyyy")}`
                : "Usage resets on the 1st of each month"}
            </span>
          </div>
          <CardDescription>
            {org.plan === "free" ? "Upgrade for more bots, pages, and messages." : `Billed in ${org.currency}`}
            {org.payment_status === "past_due" && (
              <span className="mt-1 block text-status-critical">
                Your last payment failed — Razorpay will automatically retry. Contact support if this continues.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <QuotaBar label="Bots" used={usage.bots} limit={plan.quota.bots} />
          <QuotaBar
            label="AI messages this period"
            used={usage.messagesThisPeriod}
            limit={messageLimit}
            extra={org.addon_message_balance > 0 ? `(+${org.addon_message_balance} add-on)` : undefined}
          />
          <QuotaBar label="Pages indexed" used={usage.pages} limit={plan.quota.pages} />
          <QuotaBar
            label="Team seats"
            used={usage.seats}
            limit={plan.quota.agentSeats + org.addon_seats}
            extra={org.addon_seats > 0 ? `(+${org.addon_seats} add-on)` : undefined}
          />

          {hasAddons && (
            <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/30 p-3 text-xs">
              <span className="flex items-center gap-1 font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" /> Active add-ons:
              </span>
              {org.addon_message_balance > 0 && (
                <Badge variant="outline">{org.addon_message_balance.toLocaleString()} bonus messages</Badge>
              )}
              {org.addon_seats > 0 && <Badge variant="outline">{org.addon_seats} extra seat{org.addon_seats > 1 ? "s" : ""}</Badge>}
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">What&apos;s included</p>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-1.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-good" /> {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={() => setPricingOpen(true)}>{org.plan === "free" ? "Upgrade plan" : "Change plan"}</Button>
            <Button variant="outline" onClick={() => setAddonOpen("messages")}>
              Buy add-on messages
            </Button>
            {org.plan !== "free" && (
              <Button variant="outline" onClick={() => setAddonOpen("seat")}>
                Buy extra seat
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <ManageSubscriptionPanel org={org} />

      <Dialog open={pricingOpen} onOpenChange={setPricingOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Choose a plan</DialogTitle>
            <DialogDescription>Upgrade or switch tiers any time — billed once, no auto-renewal.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <PricingTable
              defaultCurrency={org.currency}
              currentTier={org.plan}
              mode="checkout"
              onSelectPlan={handleSelectPlan}
              priceOverrides={priceOverrides}
              planOverrides={planOverrides}
            />
            <div className="mt-5 flex flex-col items-center gap-2 border-t pt-5">
              <CouponField
                purchaseKind="plan_subscription"
                currency={org.currency}
                onApplied={setAppliedCoupon}
                onCleared={() => setAppliedCoupon(null)}
              />
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <CheckoutModal
        open={!!checkoutRequest}
        // Dismissing Checkout (e.g. after a payment error) returns to the
        // plan picker rather than closing the whole flow — the coupon was
        // already validated before getting here, but a genuine Razorpay-
        // side failure shouldn't cost the user their plan selection too.
        onOpenChange={(next) => {
          if (!next) {
            setCheckoutRequest(null);
            setPricingOpen(true);
          }
        }}
        title="Complete your upgrade"
        request={checkoutRequest}
      />

      {addonOpen && (
        <AddonModal open={!!addonOpen} onOpenChange={(next) => !next && setAddonOpen(null)} addon={addonOpen} currency={org.currency} />
      )}
    </div>
  );
}
