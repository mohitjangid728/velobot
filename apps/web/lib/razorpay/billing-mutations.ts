import "server-only";
import { ADDONS, getEffectivePlan } from "@velobot/shared";
import type { BillingInterval, Currency, PlanTier } from "@velobot/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPlanOverride } from "@/lib/billing/plan-overrides";

/**
 * The single place both app/api/razorpay/verify/route.ts (client-driven,
 * immediate) and app/api/razorpay/webhook/route.ts (Razorpay-driven,
 * authoritative but possibly delayed) apply a billing change — so the two
 * paths can never drift apart. Every function here is safely re-appliable
 * with the same arguments (a plain overwrite of absolute values), except
 * applyAddonMessagesCredit, which is additive like the balance it updates
 * — callers MUST have already checked webhook-idempotency.ts before
 * calling that one, since calling it twice for the same order double-credits.
 */

function periodFields(currentStart: number | null | undefined, currentEnd: number | null | undefined) {
  return {
    current_period_start: currentStart ? new Date(currentStart * 1000).toISOString() : null,
    current_period_end: currentEnd ? new Date(currentEnd * 1000).toISOString() : null,
  };
}

export async function applyPlanActivation(
  orgId: string,
  params: {
    tier: Exclude<PlanTier, "free">;
    interval: BillingInterval;
    currency: Currency;
    subscriptionId: string;
    currentStart: number | null | undefined;
    currentEnd: number | null | undefined;
  }
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const plan = getEffectivePlan(params.tier, await getPlanOverride(params.tier));
  await admin
    .from("organizations")
    .update({
      plan: params.tier,
      billing_interval: params.interval,
      currency: params.currency,
      seats_limit: plan.quota.agentSeats,
      razorpay_subscription_id: params.subscriptionId,
      payment_status: "active",
      ...periodFields(params.currentStart, params.currentEnd),
    })
    .eq("id", orgId);
}

export async function applyAddonSeatActivation(orgId: string, params: { subscriptionId: string; quantity: number }): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin
    .from("organizations")
    .update({ addon_seats: params.quantity, addon_seats_subscription_id: params.subscriptionId })
    .eq("id", orgId);
}

/** Additive — see the module doc comment. Call at most once per successful order (guard with webhook-idempotency.ts at the call site). */
export async function applyAddonMessagesCredit(orgId: string, params: { quantity: number }): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: org } = await admin.from("organizations").select("addon_message_balance").eq("id", orgId).single();
  await admin
    .from("organizations")
    .update({ addon_message_balance: (org?.addon_message_balance ?? 0) + ADDONS.messages.amount * params.quantity })
    .eq("id", orgId);
}

/** Fires on the PLAN subscription's cancellation/completion — Razorpay only sends this once a cancellation actually takes effect (immediately, or at cycle end for `cancel_at_cycle_end`), so "on cancelled" already IS "at cycle end". Already-purchased add-on balances aren't clawed back. */
export async function resetOrgToFree(subscriptionId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const plan = getEffectivePlan("free", await getPlanOverride("free"));
  await admin
    .from("organizations")
    .update({
      plan: "free",
      billing_interval: "monthly",
      seats_limit: plan.quota.agentSeats,
      razorpay_subscription_id: null,
      current_period_start: null,
      current_period_end: null,
      payment_status: "active",
    })
    .eq("razorpay_subscription_id", subscriptionId);
}

/** Fires on the ADDON-SEAT subscription's cancellation/completion — independent of the plan subscription's own state. */
export async function clearAddonSeats(subscriptionId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin
    .from("organizations")
    .update({ addon_seats: 0, addon_seats_subscription_id: null })
    .eq("addon_seats_subscription_id", subscriptionId);
}

/** Also covers "recovery" — `subscription.charged` already fires on the first successful charge after a halted subscription resumes, and applyPlanActivation above unconditionally sets payment_status back to "active" on every charge, so no separate recovery path is needed. */
export async function markPastDueBySubscription(subscriptionId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from("organizations").update({ payment_status: "past_due" }).eq("razorpay_subscription_id", subscriptionId);
}
