import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { InviteMemberSchema, ROLE_RANK } from "@velobot/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getRoleForOrg } from "@/lib/auth/session";
import { assertCanInviteMember } from "@/lib/billing/guards";
import { sendInviteEmail } from "@/lib/notifications/invite-email";
import { generateInviteLink } from "@/lib/auth/generate-invite-link";

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

  const { data: org } = await admin.from("organizations").select("name").eq("id", params.orgId).single();

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite?token=${token}`;
  // generateLink (rather than inviteUserByEmail) creates the auth user the
  // same way but hands back the verification link instead of sending
  // Supabase's own built-in email, so every invite goes out through our
  // own branded Resend template rather than a mix of our design and
  // Supabase's default. See generateInviteLink for why an existing user's
  // email needs a magiclink fallback rather than plain "invite".
  const { actionLink, error: linkError } = await generateInviteLink(admin, parsed.data.email, redirectTo);
  if (linkError || !actionLink) {
    // A genuine failure (bad email, provider outage) — roll back rather
    // than leaving an orphaned, un-sendable invite.
    await admin.from("invites").delete().eq("id", invite.id);
    return NextResponse.json({ error: linkError ?? "Failed to generate invite link" }, { status: 500 });
  }
  await sendInviteEmail(parsed.data.email, actionLink, { orgName: org?.name ?? "your workspace", role: parsed.data.role });

  return NextResponse.json({ invite });
}
