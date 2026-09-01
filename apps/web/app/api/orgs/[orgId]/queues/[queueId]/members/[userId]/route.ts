import { NextResponse, type NextRequest } from "next/server";
import { ROLE_RANK } from "@velobot/shared";
import { getCurrentUser, getRoleForOrg } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function requireQueueAdmin(orgId: string, queueId: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const role = await getRoleForOrg(user.id, orgId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.admin) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const admin = createSupabaseAdminClient();
  const { data: queue } = await admin.from("queues").select("id").eq("id", queueId).eq("org_id", orgId).maybeSingle();
  if (!queue) return { ok: false as const, response: NextResponse.json({ error: "Queue not found" }, { status: 404 }) };

  return { ok: true as const, admin };
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { orgId: string; queueId: string; userId: string } }
) {
  const guard = await requireQueueAdmin(params.orgId, params.queueId);
  if (!guard.ok) return guard.response;

  // Only existing org members can be added — the userId must already
  // belong to this org (agent or admin).
  const { data: membership } = await guard.admin
    .from("org_members")
    .select("id")
    .eq("org_id", params.orgId)
    .eq("user_id", params.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Not a member of this workspace" }, { status: 400 });

  const { error } = await guard.admin
    .from("queue_members")
    .upsert({ queue_id: params.queueId, user_id: params.userId }, { onConflict: "queue_id,user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { orgId: string; queueId: string; userId: string } }
) {
  const guard = await requireQueueAdmin(params.orgId, params.queueId);
  if (!guard.ok) return guard.response;

  const { error } = await guard.admin
    .from("queue_members")
    .delete()
    .eq("queue_id", params.queueId)
    .eq("user_id", params.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
