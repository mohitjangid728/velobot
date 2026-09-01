import { NextResponse } from "next/server";
import { ROLE_RANK } from "@velobot/shared";
import { getActiveOrg } from "@/lib/auth/session";
import { getRazorpayClient } from "@/lib/razorpay/client";

/** Payment-history list for the self-serve billing panel — the closest in-app equivalent to Stripe portal's invoice list. */
export async function GET() {
  const { org, role } = await getActiveOrg();
  if (!org || !role) return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  if (ROLE_RANK[role] < ROLE_RANK.admin) return NextResponse.json({ error: "Only an admin can manage billing" }, { status: 403 });

  if (!org.razorpay_subscription_id) return NextResponse.json({ invoices: [] });

  try {
    const razorpay = getRazorpayClient();
    const { items } = await razorpay.invoices.all({ subscription_id: org.razorpay_subscription_id });
    const invoices = items.map((inv) => ({
      id: inv.id,
      amount: inv.amount,
      currency: inv.currency,
      status: inv.status,
      shortUrl: inv.short_url ?? null,
      createdAt: new Date(inv.created_at * 1000).toISOString(),
    }));
    return NextResponse.json({ invoices });
  } catch (err) {
    console.error("[razorpay/invoices] Failed to fetch invoices", err);
    return NextResponse.json({ error: "Could not load payment history" }, { status: 500 });
  }
}
