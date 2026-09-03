import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PLANS, PAID_TIERS, getEffectivePrice, type Organization, type Currency, type PlanPriceOverrideMap } from "@velobot/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPlanPriceOverrides } from "@/lib/billing/plan-pricing";

/** Normalizes a paid org's subscription to a monthly figure in its own currency — never summed across currencies. Uses any Super-Admin-edited price override, falling back to the static default. */
function monthlyRevenue(org: Organization, overrides: PlanPriceOverrideMap): number {
  if (org.plan === "free") return 0;
  const price = getEffectivePrice(org.plan, org.billing_interval, org.currency, overrides);
  if (price === undefined) return 0;
  return org.billing_interval === "yearly" ? price / 12 : price;
}

function formatMoney(amount: number, currency: Currency): string {
  const symbol = currency === "INR" ? "₹" : "$";
  return `${symbol}${Math.round(amount).toLocaleString()}`;
}

export default async function AdminBillingPage() {
  await requirePlatformAdmin();
  const admin = createSupabaseAdminClient();

  const { data: orgs } = await admin.from("organizations").select("*");
  const list = (orgs ?? []) as Organization[];
  const priceOverrides = await getPlanPriceOverrides();

  const payingOrgs = list.filter((o) => o.plan !== "free");
  const pastDue = list.filter((o) => o.payment_status === "past_due");
  const withAddons = list.filter((o) => o.addon_message_balance > 0 || o.addon_seats > 0);

  const mrrByCurrency: Record<Currency, number> = { USD: 0, INR: 0 };
  for (const org of payingOrgs) mrrByCurrency[org.currency] += monthlyRevenue(org, priceOverrides);

  const byPlan = PAID_TIERS.map((tier) => {
    const onTier = payingOrgs.filter((o) => o.plan === tier);
    const revenue: Record<Currency, number> = { USD: 0, INR: 0 };
    for (const org of onTier) revenue[org.currency] += monthlyRevenue(org, priceOverrides);
    return { tier, count: onTier.length, revenue };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-sm text-muted-foreground">Recurring revenue across every workspace, by currency.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex flex-col gap-1 p-4">
          <span className="text-xs font-medium text-muted-foreground">MRR (USD)</span>
          <span className="text-2xl font-bold tabular-nums">{formatMoney(mrrByCurrency.USD, "USD")}</span>
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <span className="text-xs font-medium text-muted-foreground">MRR (INR)</span>
          <span className="text-2xl font-bold tabular-nums">{formatMoney(mrrByCurrency.INR, "INR")}</span>
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <span className="text-xs font-medium text-muted-foreground">Paying workspaces</span>
          <span className="text-2xl font-bold tabular-nums">{payingOrgs.length}</span>
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <span className="text-xs font-medium text-muted-foreground">Past due</span>
          <span className="text-2xl font-bold tabular-nums text-status-critical">{pastDue.length}</span>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue by plan</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y p-0">
          {byPlan.map(({ tier, count, revenue }) => (
            <div key={tier} className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 text-sm">
              <span className="font-medium">{PLANS[tier].name}</span>
              <span className="text-muted-foreground">
                {count} workspace{count === 1 ? "" : "s"}
              </span>
              <span className="tabular-nums">
                {formatMoney(revenue.USD, "USD")} + {formatMoney(revenue.INR, "INR")}/mo
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Past-due workspaces</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y p-0">
            {pastDue.map((org) => (
              <div key={org.id} className="flex items-center justify-between px-6 py-2 text-sm">
                <Link href={`/admin/orgs/${org.id}`} className="font-medium text-primary hover:underline">
                  {org.name}
                </Link>
                <Badge variant="serious">Past due</Badge>
              </div>
            ))}
            {pastDue.length === 0 && <p className="px-6 py-4 text-sm text-muted-foreground">No past-due workspaces.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active add-ons</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y p-0">
            {withAddons.map((org) => (
              <div key={org.id} className="flex items-center justify-between px-6 py-2 text-sm">
                <Link href={`/admin/orgs/${org.id}`} className="font-medium text-primary hover:underline">
                  {org.name}
                </Link>
                <span className="flex gap-1.5 text-xs text-muted-foreground">
                  {org.addon_message_balance > 0 && <Badge variant="outline">{org.addon_message_balance.toLocaleString()} msgs</Badge>}
                  {org.addon_seats > 0 && <Badge variant="outline">+{org.addon_seats} seats</Badge>}
                </span>
              </div>
            ))}
            {withAddons.length === 0 && <p className="px-6 py-4 text-sm text-muted-foreground">No active add-ons.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
