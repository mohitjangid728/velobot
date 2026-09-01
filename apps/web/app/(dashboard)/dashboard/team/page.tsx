import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TeamManager } from "@/components/dashboard/team-manager";
import { AgentWorkloadPanel } from "@/components/dashboard/agent-workload-panel";
import { getAgentWorkload } from "@/lib/analysis/agent-metrics";
import type { OrgMember, Invite } from "@velobot/shared";

export default async function TeamPage() {
  const { org, role } = await requireRole("admin");
  const supabase = createSupabaseServerClient();

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from("org_members").select("*").eq("org_id", org.id).eq("status", "active"),
    supabase.from("invites").select("*").eq("org_id", org.id).is("accepted_at", null),
  ]);

  // org_members has no email column (it's an auth.users concern) — resolve
  // display emails via the admin client for this admin-only screen.
  const admin = createSupabaseAdminClient();
  const membersWithEmail = await Promise.all(
    (members ?? []).map(async (m) => {
      if (!m.user_id) return { ...m, email: m.invited_email ?? "" };
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      return { ...m, email: data.user?.email ?? "" };
    })
  );

  const workload = await getAgentWorkload(org.id);
  const emailByUserId = new Map(membersWithEmail.filter((m) => m.user_id).map((m) => [m.user_id as string, m.email]));
  // A workload row can name an agent who has since left the org (removed
  // from org_members but their historical resolved-conversation numbers
  // should still show up correctly attributed) — resolve those separately
  // rather than silently dropping them from the panel.
  const missingUserIds = workload.map((w) => w.userId).filter((id) => !emailByUserId.has(id));
  if (missingUserIds.length > 0) {
    const resolved = await Promise.all(missingUserIds.map(async (id) => [id, (await admin.auth.admin.getUserById(id)).data.user?.email ?? "Former teammate"] as const));
    resolved.forEach(([id, email]) => emailByUserId.set(id, email));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="text-sm text-muted-foreground">
          Admins manage bots, billing, and teammates. Agents only see the inbox.
        </p>
      </div>
      <TeamManager
        orgId={org.id}
        currentRole={role}
        seatsLimit={org.seats_limit}
        initialMembers={membersWithEmail as (OrgMember & { email: string })[]}
        initialInvites={(invites ?? []) as Invite[]}
      />
      <AgentWorkloadPanel workload={workload} emailByUserId={emailByUserId} />
    </div>
  );
}
