import { NextResponse, type NextRequest } from "next/server";
import { CreateOrgSchema, getEffectivePlan } from "@velobot/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ACTIVE_ORG_COOKIE, getCurrentUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { getPlanOverride } from "@/lib/billing/plan-overrides";
import { sendWelcomeEmail } from "@/lib/notifications/welcome-email";

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") + "-" + Math.random().toString(36).slice(2, 7)
  );
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (await isPlatformAdmin(user.id)) {
    return NextResponse.json(
      { error: "Super Admins manage all workspaces from the admin panel — they can't create their own." },
      { status: 403 }
    );
  }

  const parsed = CreateOrgSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Org creation is a privileged, one-time bootstrap step: the user has no
  // membership yet, so normal RLS policies (which require an existing
  // membership) would reject it. We verify identity above via the
  // cookie-backed session, then perform the writes with the admin client.
  const admin = createSupabaseAdminClient();
  const plan = getEffectivePlan("free", await getPlanOverride("free"));

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name: parsed.data.name, slug: slugify(parsed.data.name), plan: "free", seats_limit: plan.quota.agentSeats })
    .select()
    .single();
  if (orgError || !org) {
    return NextResponse.json({ error: orgError?.message ?? "Failed to create workspace" }, { status: 500 });
  }

  const { error: memberError } = await admin
    .from("org_members")
    .insert({ org_id: org.id, user_id: user.id, role: "admin", status: "active" });
  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  if (user.email) {
    // sendEmail swallows its own errors (logs and returns) rather than
    // throwing, so a Resend hiccup can never fail workspace creation —
    // awaited only so the send has actually been attempted before this
    // handler returns, matching every other sendEmail call site.
    await sendWelcomeEmail(user.email, { orgName: org.name });
  }

  const res = NextResponse.json({ org });
  res.cookies.set(ACTIVE_ORG_COOKIE, org.id, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("org_members")
    .select("role, organizations(*)")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ memberships: data });
}
