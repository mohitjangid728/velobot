import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUsageSummary } from "@/lib/billing/usage";
import { AdminOverviewStats, type OverviewStats } from "@/components/admin/admin-overview-stats";
import { OrgsTable, type OrgRow } from "@/components/admin/orgs-table";
import { NearLimitCard } from "@/components/admin/near-limit-card";
import { CreateOrgDialog } from "@/components/admin/create-org-dialog";
import { PLAN_TIERS, type Organization, type PlanTier } from "@velobot/shared";

export default async function AdminOrgsPage() {
  const viewer = await requirePlatformAdmin();
  const canManage = viewer.platformAdminRole === "full";
  const admin = createSupabaseAdminClient();

  const [{ data: orgs }, { count: totalBots }] = await Promise.all([
    admin.from("organizations").select("*").order("created_at", { ascending: false }),
    admin.from("bots").select("id", { count: "exact", head: true }),
  ]);

  const rows: OrgRow[] = await Promise.all(
    ((orgs ?? []) as Organization[]).map(async (org) => ({ ...org, usage: await getUsageSummary(org) }))
  );

  const stats: OverviewStats = {
    totalOrgs: rows.length,
    suspendedOrgs: rows.filter((o) => o.suspended_at).length,
    totalBots: totalBots ?? 0,
    totalMembers: rows.reduce((sum, o) => sum + o.usage.seats, 0),
    planCounts: PLAN_TIERS.reduce(
      (acc, tier) => ({ ...acc, [tier]: rows.filter((o) => o.plan === tier).length }),
      {} as Record<PlanTier, number>
    ),
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="text-sm text-muted-foreground">Every workspace on the platform.</p>
        </div>
        {canManage && <CreateOrgDialog />}
      </div>

      <AdminOverviewStats stats={stats} />

      <NearLimitCard orgs={rows} />

      <OrgsTable orgs={rows} canManage={canManage} />
    </div>
  );
}
