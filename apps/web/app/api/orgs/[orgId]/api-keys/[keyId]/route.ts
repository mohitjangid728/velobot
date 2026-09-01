import { NextResponse, type NextRequest } from "next/server";
import { ROLE_RANK } from "@velobot/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getRoleForOrg } from "@/lib/auth/session";

/** Revoke a key — keys are never deleted (kept for audit/last-used history), only revoked. */
export async function DELETE(_req: NextRequest, { params }: { params: { orgId: string; keyId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getRoleForOrg(user.id, params.orgId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createSupabaseAdminClient();
  await admin
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", params.keyId)
    .eq("org_id", params.orgId);

  return NextResponse.json({ ok: true });
}
