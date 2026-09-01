import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdminAuditAction, AdminAuditLog } from "@velobot/shared";

/** Fire-and-forget on purpose — a logging failure must never block the admin action it's recording. */
export async function logAdminAction(
  actorUserId: string,
  action: AdminAuditAction,
  targetOrgId: string | null,
  details: Record<string, unknown> = {}
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("admin_audit_log")
    .insert({ actor_user_id: actorUserId, action, target_org_id: targetOrgId, details });
  if (error) console.error("Failed to write admin audit log entry:", error.message, { action, targetOrgId });
}

export type AdminAuditLogWithActor = AdminAuditLog & { actorEmail: string };

async function withActorEmails(rows: AdminAuditLog[]): Promise<AdminAuditLogWithActor[]> {
  const admin = createSupabaseAdminClient();
  const uniqueActorIds = [...new Set(rows.map((r) => r.actor_user_id))];
  const emailById = new Map<string, string>();
  await Promise.all(
    uniqueActorIds.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      emailById.set(id, data.user?.email ?? "Unknown");
    })
  );
  return rows.map((r) => ({ ...r, actorEmail: emailById.get(r.actor_user_id) ?? "Unknown" }));
}

export async function getAuditLogForOrg(orgId: string, limit = 25): Promise<AdminAuditLogWithActor[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("admin_audit_log")
    .select("*")
    .eq("target_org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return withActorEmails((data ?? []) as AdminAuditLog[]);
}

export async function getPlatformAuditLog(limit = 200): Promise<AdminAuditLogWithActor[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(limit);
  return withActorEmails((data ?? []) as AdminAuditLog[]);
}
