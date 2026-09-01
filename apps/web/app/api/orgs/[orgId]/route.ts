import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ROLE_RANK } from "@velobot/shared";
import { getCurrentUser, getRoleForOrg } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const UpdateOrgSchema = z.object({ name: z.string().min(2).max(80) });

export async function PATCH(req: NextRequest, { params }: { params: { orgId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getRoleForOrg(user.id, params.orgId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = UpdateOrgSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: org, error } = await admin.from("organizations").update({ name: parsed.data.name }).eq("id", params.orgId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ org });
}

export async function DELETE(_req: NextRequest, { params }: { params: { orgId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getRoleForOrg(user.id, params.orgId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("organizations").delete().eq("id", params.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
