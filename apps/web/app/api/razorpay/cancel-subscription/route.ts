import { NextResponse } from "next/server";
import { z } from "zod";
import { ROLE_RANK } from "@velobot/shared";
import { getActiveOrg } from "@/lib/auth/session";
import { getRazorpayClient } from "@/lib/razorpay/client";

const CancelSchema = z.object({ target: z.enum(["plan", "addon_seat"]) });

/**
 * The self-serve piece Razorpay's lack of a hosted Customer Portal
 * requires building in-app. Does NOT mutate the DB directly — the
 * subscription.cancelled webhook is still the single source of truth for
 * org state, exactly as it already is for a Razorpay-initiated
 * cancellation (e.g. failed retries exhausting Razorpay's own dunning).
 */
export async function POST(req: Request) {
  const { org, role } = await getActiveOrg();
  if (!org || !role) return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  if (ROLE_RANK[role] < ROLE_RANK.admin) return NextResponse.json({ error: "Only an admin can manage billing" }, { status: 403 });

  const parsed = CancelSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const subscriptionId = parsed.data.target === "plan" ? org.razorpay_subscription_id : org.addon_seats_subscription_id;
  if (!subscriptionId) return NextResponse.json({ error: "No active subscription to cancel" }, { status: 400 });

  try {
    const razorpay = getRazorpayClient();
    // cancel_at_cycle_end: true — matches the "cancel at period end" UX a
    // Stripe customer-portal cancellation defaulted to; the customer keeps
    // access through what they already paid for.
    await razorpay.subscriptions.cancel(subscriptionId, true);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[razorpay/cancel-subscription] Failed to cancel", err);
    return NextResponse.json({ error: "Could not cancel the subscription" }, { status: 500 });
  }
}
