import { NextResponse, type NextRequest } from "next/server";
import { UpdatePlanPriceSchema } from "@velobot/shared";
import { requirePlatformAdminApi, requireFullPlatformAdminApi } from "@/lib/auth/platform-admin";
import { listPlanPriceOverrides, upsertPlanPriceOverride } from "@/lib/billing/plan-pricing";
import { logAdminAction } from "@/lib/admin/audit-log";

export async function GET() {
  const admin = await requirePlatformAdminApi();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const overrides = await listPlanPriceOverrides();
  return NextResponse.json({ overrides });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireFullPlatformAdminApi();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = UpdatePlanPriceSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const override = await upsertPlanPriceOverride({ ...parsed.data, updatedBy: admin.id });
    await logAdminAction(admin.id, "plan.update_price", null, {
      tier: parsed.data.tier,
      interval: parsed.data.interval,
      currency: parsed.data.currency,
      amount: parsed.data.amount,
    });
    return NextResponse.json({ override });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to save price" }, { status: 500 });
  }
}
