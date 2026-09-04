import { NextResponse } from "next/server";
import { z } from "zod";
import { ROLE_RANK } from "@velobot/shared";
import { getActiveOrg } from "@/lib/auth/session";
import { validateCoupon } from "@/lib/billing/coupons";

const ValidateCouponSchema = z.object({
  code: z.string().min(1),
  purchaseKind: z.enum(["messages_addon", "plan_subscription"]),
  currency: z.enum(["USD", "INR"]),
});

/**
 * Checks a coupon code before the user commits to a specific plan/add-on
 * tier — existence, active, not expired, redemption limit, applies_to,
 * currency (for fixed discounts), and not already used by this org. The
 * amount-aware discount itself is still computed for real at checkout
 * time (checkout/route.ts), so this intentionally passes 0 as the amount
 * and ignores discountedAmount/amountDiscounted — this endpoint only
 * answers "is this code usable," so a bad code can be caught and shown
 * inline on the plan picker instead of only surfacing once checkout has
 * already been kicked off (see billing-panel.tsx / addon-modal.tsx).
 */
export async function POST(req: Request) {
  const { org, role } = await getActiveOrg();
  if (!org || !role) return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  if (ROLE_RANK[role] < ROLE_RANK.admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = ValidateCouponSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const result = await validateCoupon(parsed.data.code, parsed.data.purchaseKind, org.id, 0, parsed.data.currency);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
