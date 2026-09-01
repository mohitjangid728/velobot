import { NextResponse, type NextRequest } from "next/server";
import { ROLE_RANK } from "@velobot/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getRoleForOrg } from "@/lib/auth/session";
import { sendInviteEmail, isAlreadyRegisteredError } from "@/lib/notifications/invite-email";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Manual fallback for "the invite email never arrived" — re-sends via the
 * same path the original invite used (Supabase's mailer for a brand-new
 * email, our own Resend-based email for an existing user), refreshing
 * expires_at only if the invite had already expired so a still-valid link
 * isn't silently invalidated.
 */
export async function POST(_req: NextRequest, { params }: { params: { orgId: string; inviteId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getRoleForOrg(user.id, params.orgId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data: invite } = await admin
    .from("invites")
    .select("*")
    .eq("id", params.inviteId)
    .eq("org_id", params.orgId)
    .is("accepted_at", null)
    .maybeSingle();
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  let token = invite.token;
  if (new Date(invite.expires_at) < new Date()) {
    const { randomBytes } = await import("crypto");
    token = randomBytes(24).toString("hex");
    await admin
      .from("invites")
      .update({ token, expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString() })
      .eq("id", invite.id);
  }

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite?token=${token}`;
  const { error: mailError } = await admin.auth.admin.inviteUserByEmail(invite.email, { redirectTo });
  if (mailError) {
    if (!isAlreadyRegisteredError(mailError.message)) {
      return NextResponse.json({ error: mailError.message }, { status: 500 });
    }
    // Same "already has an account" fallback as the original invite path.
    await sendInviteEmail(invite.email, redirectTo, { existingUser: true });
  }

  return NextResponse.json({ ok: true });
}
