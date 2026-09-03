import { NextResponse, type NextRequest } from "next/server";
import { UpdatePlanDetailsSchema, type PlanTier } from "@velobot/shared";
import { requireFullPlatformAdminApi } from "@/lib/auth/platform-admin";
import { upsertPlanOverride } from "@/lib/billing/plan-overrides";
import { logAdminAction } from "@/lib/admin/audit-log";

const VALID_TIERS: PlanTier[] = ["free", "hobby", "growth", "business"];

export async function PATCH(req: NextRequest, { params }: { params: { tier: string } }) {
  const admin = await requireFullPlatformAdminApi();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!VALID_TIERS.includes(params.tier as PlanTier)) {
    return NextResponse.json({ error: "Unknown plan tier" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = UpdatePlanDetailsSchema.safeParse({ ...body, tier: params.tier });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const override = await upsertPlanOverride(parsed.data, admin.id);
    await logAdminAction(admin.id, "plan.update_details", null, { tier: params.tier, fields: Object.keys(body) });
    return NextResponse.json({ override });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to save plan details" }, { status: 500 });
  }
}
