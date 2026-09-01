import { NextResponse, type NextRequest } from "next/server";
import { CreateOrgNoteSchema } from "@velobot/shared";
import { requirePlatformAdminApi } from "@/lib/auth/platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "@/lib/admin/audit-log";

export async function GET(_req: NextRequest, { params }: { params: { orgId: string } }) {
  const admin = await requirePlatformAdminApi();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: notes, error } = await supabaseAdmin
    .from("admin_org_notes")
    .select("*")
    .eq("org_id", params.orgId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const withEmail = await Promise.all(
    (notes ?? []).map(async (n) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(n.author_user_id);
      return { ...n, authorEmail: data.user?.email ?? "Unknown" };
    })
  );

  return NextResponse.json({ notes: withEmail });
}

/** Any Super Admin role can leave notes — this is support activity, not a mutation of the org itself. */
export async function POST(req: NextRequest, { params }: { params: { orgId: string } }) {
  const admin = await requirePlatformAdminApi();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = CreateOrgNoteSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: note, error } = await supabaseAdmin
    .from("admin_org_notes")
    .insert({ org_id: params.orgId, author_user_id: admin.id, note: parsed.data.note })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction(admin.id, "org.note_add", params.orgId, { note: parsed.data.note.slice(0, 200) });

  return NextResponse.json({ note: { ...note, authorEmail: admin.email ?? "Unknown" } });
}
