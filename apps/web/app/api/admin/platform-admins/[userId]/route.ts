import { NextResponse, type NextRequest } from "next/server";
import { requireFullPlatformAdminApi } from "@/lib/auth/platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "@/lib/admin/audit-log";

export async function DELETE(_req: NextRequest, { params }: { params: { userId: string } }) {
  const admin = await requireFullPlatformAdminApi();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin.from("platform_admins").delete().eq("user_id", params.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction(admin.id, "admin.demote", null, { user_id: params.userId });

  return NextResponse.json({ ok: true });
}
