import { NextResponse, type NextRequest } from "next/server";
import { PromotePlatformAdminSchema } from "@velobot/shared";
import { requirePlatformAdminApi, requireFullPlatformAdminApi } from "@/lib/auth/platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "@/lib/admin/audit-log";

export async function GET() {
  const admin = await requirePlatformAdminApi();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: rows, error } = await supabaseAdmin.from("platform_admins").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const withEmail = await Promise.all(
    (rows ?? []).map(async (row) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
      return { ...row, email: data.user?.email ?? "" };
    })
  );

  return NextResponse.json({ admins: withEmail });
}

export async function POST(req: NextRequest) {
  const admin = await requireFullPlatformAdminApi();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = PromotePlatformAdminSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const supabaseAdmin = createSupabaseAdminClient();

  // Super Admin promotion requires an existing account — never invite-by-email.
  let targetUserId: string | null = null;
  let page = 1;
  while (!targetUserId) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const match = data.users.find((u) => u.email?.toLowerCase() === parsed.data.email.toLowerCase());
    if (match) targetUserId = match.id;
    else if (data.users.length < 200) break;
    else page += 1;
  }
  if (!targetUserId) {
    return NextResponse.json({ error: "No account found for that email. They must sign up first." }, { status: 404 });
  }

  const { data: row, error } = await supabaseAdmin
    .from("platform_admins")
    .upsert({ user_id: targetUserId, granted_by: admin.id, role: parsed.data.role }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction(admin.id, "admin.promote", null, { email: parsed.data.email, user_id: targetUserId, role: parsed.data.role });

  return NextResponse.json({ admin: { ...row, email: parsed.data.email } });
}
