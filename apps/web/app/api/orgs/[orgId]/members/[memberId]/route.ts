import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ROLE_RANK } from "@velobot/shared";
import { getCurrentUser, getRoleForOrg } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { wouldRemoveLastAdmin } from "@/lib/auth/last-admin-guard";

const UpdateRoleSchema = z.object({ role: z.enum(["admin", "agent"]) });

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orgId: string; memberId: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getRoleForOrg(user.id, params.orgId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = UpdateRoleSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: target } = await admin.from("org_members").select("*").eq("id", params.memberId).eq("org_id", params.orgId).maybeSingle();
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  if (parsed.data.role === "agent" && (await wouldRemoveLastAdmin(admin, params.orgId, target.role))) {
    return NextResponse.json({ error: "Cannot demote the last admin — promote someone else first." }, { status: 400 });
  }

  const { data: updated, error } = await admin
    .from("org_members")
    .update({ role: parsed.data.role })
    .eq("id", params.memberId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ member: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { orgId: string; memberId: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getRoleForOrg(user.id, params.orgId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createSupabaseAdminClient();
  const { data: target } = await admin.from("org_members").select("role").eq("id", params.memberId).eq("org_id", params.orgId).maybeSingle();
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  if (await wouldRemoveLastAdmin(admin, params.orgId, target.role)) {
    return NextResponse.json({ error: "Cannot remove the last admin — promote someone else first." }, { status: 400 });
  }

  const { error } = await admin.from("org_members").delete().eq("id", params.memberId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
