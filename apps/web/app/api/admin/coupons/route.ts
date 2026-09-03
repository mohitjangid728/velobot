import { NextResponse, type NextRequest } from "next/server";
import { CreateCouponSchema } from "@velobot/shared";
import { requirePlatformAdminApi, requireFullPlatformAdminApi } from "@/lib/auth/platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "@/lib/admin/audit-log";

export async function GET() {
  const admin = await requirePlatformAdminApi();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.from("coupons").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ coupons: data });
}

export async function POST(req: NextRequest) {
  const admin = await requireFullPlatformAdminApi();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = CreateCouponSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: coupon, error } = await supabaseAdmin
    .from("coupons")
    .insert({
      code: parsed.data.code.toUpperCase(),
      discount_type: parsed.data.discount_type,
      discount_value: parsed.data.discount_value,
      applies_to: parsed.data.applies_to,
      razorpay_offer_id: parsed.data.razorpay_offer_id ?? null,
      max_redemptions: parsed.data.max_redemptions ?? null,
      expires_at: parsed.data.expires_at ?? null,
      created_by: admin.id,
    })
    .select()
    .single();
  if (error || !coupon) {
    const message = error?.code === "23505" ? "A coupon with this code already exists" : error?.message ?? "Failed to create coupon";
    return NextResponse.json({ error: message }, { status: error?.code === "23505" ? 409 : 500 });
  }

  await logAdminAction(admin.id, "coupon.create", null, { code: coupon.code, discount_type: coupon.discount_type, discount_value: coupon.discount_value });

  return NextResponse.json({ coupon });
}
