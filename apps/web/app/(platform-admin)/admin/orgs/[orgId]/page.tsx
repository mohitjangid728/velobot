import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUsageSummary } from "@/lib/billing/usage";
import { getAuditLogForOrg } from "@/lib/admin/audit-log";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrgDetailPanel } from "@/components/admin/org-detail-panel";
import { OrgUsageCard } from "@/components/admin/org-usage-card";
import { OrgBillingCard } from "@/components/admin/org-billing-card";
import { OrgAuditLog } from "@/components/admin/org-audit-log";
import { OrgNotesCard } from "@/components/admin/org-notes-card";
import { DeleteOrgDialog } from "@/components/admin/delete-org-dialog";
import type { AdminOrgNote, Organization } from "@velobot/shared";
import { getPlanOverride } from "@/lib/billing/plan-overrides";

export default async function AdminOrgDetailPage({ params }: { params: { orgId: string } }) {
  const viewer = await requirePlatformAdmin();
  const canManage = viewer.platformAdminRole === "full";
  const admin = createSupabaseAdminClient();

  const { data: org } = await admin.from("organizations").select("*").eq("id", params.orgId).maybeSingle();
  if (!org) notFound();
  const typedOrg = org as Organization;

  const [{ data: members }, { data: bots }, usage, auditLog, { data: notes }, planOverrides] = await Promise.all([
    admin.from("org_members").select("*").eq("org_id", params.orgId).eq("status", "active"),
    admin.from("bots").select("*").eq("org_id", params.orgId),
    getUsageSummary(typedOrg),
    getAuditLogForOrg(params.orgId),
    admin.from("admin_org_notes").select("*").eq("org_id", params.orgId).order("created_at", { ascending: false }),
    getPlanOverride(typedOrg.plan),
  ]);

  const membersWithEmail = await Promise.all(
    (members ?? []).map(async (m) => {
      if (!m.user_id) return { ...m, email: m.invited_email ?? "" };
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      return { ...m, email: data.user?.email ?? "" };
    })
  );

  const notesWithEmail = await Promise.all(
    ((notes ?? []) as AdminOrgNote[]).map(async (n) => {
      const { data } = await admin.auth.admin.getUserById(n.author_user_id);
      return { ...n, authorEmail: data.user?.email ?? "Unknown" };
    })
  );

  return (
    <div className="flex flex-col gap-6">
      <OrgDetailPanel org={typedOrg} canManage={canManage} />

      <div className="grid gap-6 sm:grid-cols-2">
        <OrgUsageCard org={typedOrg} usage={usage} planOverrides={planOverrides} />
        <OrgBillingCard org={typedOrg} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Members</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y p-0">
            {membersWithEmail.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-6 py-2 text-sm">
                <span>{m.email}</span>
                <span className="capitalize text-muted-foreground">{m.role}</span>
              </div>
            ))}
            {membersWithEmail.length === 0 && <p className="px-6 py-4 text-sm text-muted-foreground">No members.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bots</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y p-0">
            {(bots ?? []).map((b) => (
              <Link
                key={b.id}
                href={`/admin/orgs/${params.orgId}/bots/${b.id}`}
                className="px-6 py-2 text-sm text-primary hover:underline"
              >
                {b.name}
              </Link>
            ))}
            {(bots ?? []).length === 0 && <p className="px-6 py-4 text-sm text-muted-foreground">No bots.</p>}
          </CardContent>
        </Card>

        <OrgNotesCard orgId={params.orgId} initialNotes={notesWithEmail} />
      </div>

      <OrgAuditLog entries={auditLog} />

      {canManage && <DeleteOrgDialog orgId={typedOrg.id} orgSlug={typedOrg.slug} orgName={typedOrg.name} />}
    </div>
  );
}
