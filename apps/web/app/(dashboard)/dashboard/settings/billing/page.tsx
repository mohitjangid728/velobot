import { requireRole } from "@/lib/auth/session";
import { BillingPanel } from "@/components/dashboard/billing-panel";
import { getUsageSummary } from "@/lib/billing/usage";

export default async function BillingPage() {
  const { org } = await requireRole("admin");
  const usage = await getUsageSummary(org);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-bold">Billing</h1>
      <BillingPanel org={org} usage={usage} />
    </div>
  );
}
