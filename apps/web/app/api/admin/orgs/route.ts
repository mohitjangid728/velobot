import { NextResponse, type NextRequest } from "next/server";
import { CreateOrgAdminSchema, getEffectivePlan } from "@velobot/shared";
import { requireFullPlatformAdminApi } from "@/lib/auth/platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { getPlanOverride } from "@/lib/billing/plan-overrides";

/** Mirrors app/api/orgs/route.ts's self-signup slugify — kept separate since that route may evolve independently. */
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
  const admin = await requireFullPlatformAdminApi();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = CreateOrgAdminSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabaseAdmin = createSupabaseAdminClient();
  const plan = getEffectivePlan("free", await getPlanOverride("free"));
  const { data: org, error } = await supabaseAdmin
    .from("organizations")
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug || slugify(parsed.data.name),
      plan: "free",
      seats_limit: plan.quota.agentSeats,
    })
    .select()
    .single();
  if (error || !org) {
    return NextResponse.json({ error: error?.message ?? "Failed to create workspace" }, { status: 500 });
  }

  await logAdminAction(admin.id, "org.create", org.id, { name: org.name, slug: org.slug });

  return NextResponse.json({ org });
}
