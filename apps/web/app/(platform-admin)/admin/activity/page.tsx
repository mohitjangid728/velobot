import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPlatformAuditLog } from "@/lib/admin/audit-log";
import { OrgAuditLog } from "@/components/admin/org-audit-log";

export default async function AdminActivityPage() {
  await requirePlatformAdmin();
  const admin = createSupabaseAdminClient();

  const [entries, { data: orgs }] = await Promise.all([
    getPlatformAuditLog(),
    admin.from("organizations").select("id, name"),
  ]);

  const orgNameById = Object.fromEntries((orgs ?? []).map((o) => [o.id, o.name]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Activity</h1>
        <p className="text-sm text-muted-foreground">Every Super Admin action across the platform, most recent first.</p>
      </div>

      <OrgAuditLog entries={entries} showOrgName orgNameById={orgNameById} />
    </div>
  );
}
