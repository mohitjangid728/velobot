import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, ACTIVE_ORG_COOKIE } from "@/lib/auth/session";

const AcceptInviteSchema = z.object({ token: z.string().min(10) });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = AcceptInviteSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: invite, error } = await admin
    .from("invites")
    .select("*")
    .eq("token", parsed.data.token)
    .is("accepted_at", null)
    .maybeSingle();

  if (error || !invite) return NextResponse.json({ error: "Invite not found or already used" }, { status: 404 });
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invite has expired" }, { status: 410 });
  }
  if (invite.email.toLowerCase() !== user.email?.toLowerCase()) {
    return NextResponse.json({ error: "This invite was sent to a different email address" }, { status: 403 });
  }

  const { error: memberError } = await admin.from("org_members").upsert(
    {
      org_id: invite.org_id,
      user_id: user.id,
      role: invite.role,
      status: "active",
      invited_email: invite.email,
      invited_by: invite.invited_by,
    },
    { onConflict: "org_id,user_id" }
  );
  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });

  await admin.from("invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);

  const res = NextResponse.json({ ok: true, org_id: invite.org_id });
  res.cookies.set(ACTIVE_ORG_COOKIE, invite.org_id, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
