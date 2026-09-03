import { NextResponse, type NextRequest } from "next/server";
import { requireFullPlatformAdminApi } from "@/lib/auth/platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "@/lib/admin/audit-log";

/** Only supports revoking (is_active: false) — a coupon is never edited after creation, only deactivated, so past redemptions stay accurate. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireFullPlatformAdminApi();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  if (body.is_active !== false) {
    return NextResponse.json({ error: "Only revoking a coupon (is_active: false) is supported" }, { status: 400 });
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: coupon, error } = await supabaseAdmin
    .from("coupons")
    .update({ is_active: false })
    .eq("id", params.id)
    .select()
    .single();
  if (error || !coupon) return NextResponse.json({ error: error?.message ?? "Coupon not found" }, { status: 404 });

  await logAdminAction(admin.id, "coupon.revoke", null, { code: coupon.code });

  return NextResponse.json({ coupon });
}
