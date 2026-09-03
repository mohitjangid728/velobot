import { requireRole } from "@/lib/auth/session";
import { BillingPanel } from "@/components/dashboard/billing-panel";
import { getUsageSummary } from "@/lib/billing/usage";
import { getPlanPriceOverrides } from "@/lib/billing/plan-pricing";
import { getPlanOverrides } from "@/lib/billing/plan-overrides";

export default async function BillingPage() {
  const { org } = await requireRole("admin");
  const [usage, priceOverrides, planOverrides] = await Promise.all([
    getUsageSummary(org),
    getPlanPriceOverrides(),
    getPlanOverrides(),
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-bold">Billing</h1>
      <BillingPanel org={org} usage={usage} priceOverrides={priceOverrides} planOverrides={planOverrides} />
    </div>
  );
}
