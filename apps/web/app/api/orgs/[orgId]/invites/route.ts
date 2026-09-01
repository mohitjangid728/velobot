import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { InviteMemberSchema, ROLE_RANK } from "@velobot/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getRoleForOrg } from "@/lib/auth/session";
import { assertCanInviteMember } from "@/lib/billing/guards";
import { sendInviteEmail, isAlreadyRegisteredError } from "@/lib/notifications/invite-email";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(_req: NextRequest, { params }: { params: { orgId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getRoleForOrg(user.id, params.orgId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseServerClient();
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from("org_members").select("*").eq("org_id", params.orgId).eq("status", "active"),
    supabase.from("invites").select("*").eq("org_id", params.orgId).is("accepted_at", null),
  ]);
  return NextResponse.json({ members, invites });
}

export async function POST(req: NextRequest, { params }: { params: { orgId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getRoleForOrg(user.id, params.orgId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = InviteMemberSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const seatGuard = await assertCanInviteMember(params.orgId);
  if (!seatGuard.allowed) return NextResponse.json({ error: seatGuard.reason }, { status: 402 });

  const admin = createSupabaseAdminClient();
  const token = randomBytes(24).toString("hex");
  const { data: invite, error: inviteError } = await admin
    .from("invites")
    .insert({
      org_id: params.orgId,
      email: parsed.data.email,
      role: parsed.data.role,
      token,
      invited_by: user.id,
      expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
    })
    .select()
    .single();
  if (inviteError || !invite) {
    return NextResponse.json({ error: inviteError?.message ?? "Failed to create invite" }, { status: 500 });
  }

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite?token=${token}`;
  const { error: mailError } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, { redirectTo });
  if (mailError) {
    if (isAlreadyRegisteredError(mailError.message)) {
      // The invitee already has a VeloBot account — Supabase's own mailer
      // won't send to them, so fall back to our own transactional email
      // (Resend) with the same accept-invite link. accept/route.ts already
      // handles a logged-in existing user correctly (just checks the email
      // matches and upserts membership), so this path was always reachable,
      // just never triggered before now.
      await sendInviteEmail(parsed.data.email, redirectTo, { existingUser: true });
    } else {
      // A genuine failure (bad email, provider outage) — roll back rather
      // than leaving an orphaned, un-sendable invite.
      await admin.from("invites").delete().eq("id", invite.id);
      return NextResponse.json({ error: mailError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ invite });
}
