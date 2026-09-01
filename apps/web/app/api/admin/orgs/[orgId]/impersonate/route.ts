import { NextResponse, type NextRequest } from "next/server";
import { requireFullPlatformAdminApi } from "@/lib/auth/platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ACTIVE_ORG_COOKIE, IMPERSONATION_COOKIE } from "@/lib/auth/session";
import { logAdminAction } from "@/lib/admin/audit-log";

export async function POST(_req: NextRequest, { params }: { params: { orgId: string } }) {
  const admin = await requireFullPlatformAdminApi();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: org } = await supabaseAdmin.from("organizations").select("id, name").eq("id", params.orgId).maybeSingle();
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logAdminAction(admin.id, "org.impersonate", org.id, { org_name: org.name });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACTIVE_ORG_COOKIE, org.id, { httpOnly: true, sameSite: "lax", path: "/" });
  res.cookies.set(IMPERSONATION_COOKIE, org.id, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
