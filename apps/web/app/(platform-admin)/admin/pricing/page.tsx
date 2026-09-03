import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { listPlanPriceOverrides } from "@/lib/billing/plan-pricing";
import { listPlanOverridesRaw } from "@/lib/billing/plan-overrides";
import { PlanEditor } from "@/components/admin/plan-editor";

export default async function AdminPricingPage() {
  const user = await requirePlatformAdmin();
  const [priceOverrides, planOverrides] = await Promise.all([listPlanPriceOverrides(), listPlanOverridesRaw()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Plans</h1>
        <p className="text-sm text-muted-foreground">
          Edit pricing, quotas, capabilities, marketing features, and promotional badges for every tier.
        </p>
      </div>
      <PlanEditor
        initialPriceOverrides={priceOverrides}
        initialPlanOverrides={planOverrides}
        canManage={user.platformAdminRole === "full"}
      />
    </div>
  );
}
