import { NextResponse, type NextRequest } from "next/server";
import { UpdateOrgAdminSchema } from "@velobot/shared";
import { requirePlatformAdminApi, requireFullPlatformAdminApi } from "@/lib/auth/platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "@/lib/admin/audit-log";

export async function GET(_req: NextRequest, { params }: { params: { orgId: string } }) {
  const admin = await requirePlatformAdminApi();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: org } = await supabaseAdmin.from("organizations").select("*").eq("id", params.orgId).maybeSingle();
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [{ data: members }, { data: bots }] = await Promise.all([
    supabaseAdmin.from("org_members").select("*").eq("org_id", params.orgId).eq("status", "active"),
    supabaseAdmin.from("bots").select("*").eq("org_id", params.orgId),
  ]);

  const membersWithEmail = await Promise.all(
    (members ?? []).map(async (m) => {
      if (!m.user_id) return { ...m, email: m.invited_email ?? "" };
      const { data } = await supabaseAdmin.auth.admin.getUserById(m.user_id);
      return { ...m, email: data.user?.email ?? "" };
    })
  );

  return NextResponse.json({ org, members: membersWithEmail, bots: bots ?? [] });
}

export async function PATCH(req: NextRequest, { params }: { params: { orgId: string } }) {
  const admin = await requireFullPlatformAdminApi();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = UpdateOrgAdminSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: before } = await supabaseAdmin.from("organizations").select("*").eq("id", params.orgId).maybeSingle();
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.slug !== undefined) patch.slug = parsed.data.slug;
  if (parsed.data.plan !== undefined) patch.plan = parsed.data.plan;
  if (parsed.data.seats_limit !== undefined) patch.seats_limit = parsed.data.seats_limit;
  if (parsed.data.suspended !== undefined) patch.suspended_at = parsed.data.suspended ? new Date().toISOString() : null;
  if (parsed.data.addon_message_balance !== undefined) patch.addon_message_balance = parsed.data.addon_message_balance;
  if (parsed.data.addon_seats !== undefined) patch.addon_seats = parsed.data.addon_seats;

  const { data: org, error } = await supabaseAdmin.from("organizations").update(patch).eq("id", params.orgId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (
    (parsed.data.name !== undefined && parsed.data.name !== before.name) ||
    (parsed.data.slug !== undefined && parsed.data.slug !== before.slug)
  ) {
    await logAdminAction(admin.id, "org.rename", org.id, {
      name: { from: before.name, to: org.name },
      slug: { from: before.slug, to: org.slug },
    });
  }
  if (parsed.data.plan !== undefined && parsed.data.plan !== before.plan) {
    await logAdminAction(admin.id, "org.update_plan", org.id, { from: before.plan, to: parsed.data.plan });
  }
  if (parsed.data.seats_limit !== undefined && parsed.data.seats_limit !== before.seats_limit) {
    await logAdminAction(admin.id, "org.update_seats_limit", org.id, { from: before.seats_limit, to: parsed.data.seats_limit });
  }
  if (
    (parsed.data.addon_message_balance !== undefined && parsed.data.addon_message_balance !== before.addon_message_balance) ||
    (parsed.data.addon_seats !== undefined && parsed.data.addon_seats !== before.addon_seats)
  ) {
    await logAdminAction(admin.id, "org.update_addons", org.id, {
      addon_message_balance: { from: before.addon_message_balance, to: org.addon_message_balance },
      addon_seats: { from: before.addon_seats, to: org.addon_seats },
    });
  }
  if (parsed.data.suspended !== undefined && !!before.suspended_at !== parsed.data.suspended) {
    await logAdminAction(admin.id, parsed.data.suspended ? "org.suspend" : "org.reactivate", org.id);
  }

  return NextResponse.json({ org });
}

/** Cascades to every org-scoped table (bots, conversations, messages, connections, ...) — see supabase/sql/*.sql `on delete cascade`. Irreversible. */
export async function DELETE(_req: NextRequest, { params }: { params: { orgId: string } }) {
  const admin = await requireFullPlatformAdminApi();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: org } = await supabaseAdmin.from("organizations").select("id, name, slug, plan").eq("id", params.orgId).maybeSingle();
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Logged before deletion since admin_audit_log.target_org_id is set null on delete —
  // the org's identity is preserved in `details` either way.
  await logAdminAction(admin.id, "org.delete", org.id, { name: org.name, slug: org.slug, plan: org.plan });

  const { error } = await supabaseAdmin.from("organizations").delete().eq("id", params.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
