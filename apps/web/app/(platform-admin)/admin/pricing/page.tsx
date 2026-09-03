import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { listPlanPriceOverrides } from "@/lib/billing/plan-pricing";
import { PricingEditor } from "@/components/admin/pricing-editor";

export default async function AdminPricingPage() {
  const user = await requirePlatformAdmin();
  const overrides = await listPlanPriceOverrides();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Plan pricing</h1>
        <p className="text-sm text-muted-foreground">Override the default price for any tier, interval, or currency.</p>
      </div>
      <PricingEditor initialOverrides={overrides} canManage={user.platformAdminRole === "full"} />
    </div>
  );
}
