import "server-only";
import { PLANS } from "@velobot/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBotCount, getPagesIndexed, getMessagesUsedThisPeriod, getActiveMemberCount, getPeriodStart } from "@/lib/billing/usage";
import type { Organization, PlanCapabilities } from "@velobot/shared";

export interface GuardResult {
  allowed: boolean;
  reason?: string;
}

async function loadOrg(orgId: string): Promise<Organization> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("organizations").select("*").eq("id", orgId).single();
  if (error || !data) throw new Error(`Organization ${orgId} not found`);
  return data as Organization;
}

export async function assertCanCreateBot(orgId: string): Promise<GuardResult> {
  const org = await loadOrg(orgId);
  const limit = PLANS[org.plan].quota.bots;
  const used = await getBotCount(orgId);
  if (used >= limit) {
    return { allowed: false, reason: `Your ${PLANS[org.plan].name} plan allows up to ${limit} bot(s). Upgrade to add more.` };
  }
  return { allowed: true };
}

/** `incomingPages` is the number of NEW pages a crawl/upload is about to add — checked before ingestion runs, not after. */
export async function assertCanIngestPages(orgId: string, incomingPages: number): Promise<GuardResult> {
  const org = await loadOrg(orgId);
  const limit = PLANS[org.plan].quota.pages;
  const used = await getPagesIndexed(orgId);
  if (used + incomingPages > limit) {
    return {
      allowed: false,
      reason: `Your ${PLANS[org.plan].name} plan allows up to ${limit} indexed pages (${used} used). Upgrade to index more.`,
    };
  }
  return { allowed: true };
}

export interface MessageGuardResult extends GuardResult {
  /** True if this message will consume from the add-on pool rather than the plan's base allowance — caller must decrement addon_message_balance by 1 after a successful completion. */
  usesAddonBalance: boolean;
}

export async function assertCanSendAiMessage(orgId: string): Promise<MessageGuardResult> {
  const org = await loadOrg(orgId);
  const limit = PLANS[org.plan].quota.messagesPerMonth;
  const periodStart = getPeriodStart(org);
  const used = await getMessagesUsedThisPeriod(orgId, periodStart);

  if (used < limit) return { allowed: true, usesAddonBalance: false };
  if (org.addon_message_balance > 0) return { allowed: true, usesAddonBalance: true };

  return {
    allowed: false,
    usesAddonBalance: false,
    reason: `This bot has reached its monthly message limit. Ask a workspace admin to upgrade the plan or buy an add-on message pack.`,
  };
}

/**
 * Call after a message guarded by `usesAddonBalance: true` actually
 * completes successfully. Read-then-write rather than an atomic RPC — a
 * lost race under concurrent messages just means one extra message rides
 * on the balance being one lower than ideal for a moment, not a security
 * issue, and doesn't justify a dedicated SQL function for this one op.
 */
export async function consumeAddonMessage(orgId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("organizations").select("addon_message_balance").eq("id", orgId).single();
  const current = data?.addon_message_balance ?? 0;
  await admin
    .from("organizations")
    .update({ addon_message_balance: Math.max(0, current - 1) })
    .eq("id", orgId);
}

/**
 * The one boolean-feature guard in this file — every other guard here is
 * quota-shaped (numeric limit vs. usage). Used for the two capabilities
 * introduced alongside the launch-readiness batch: apiAccess (issuing
 * Developer API keys) and removeBranding (hiding the widget footer).
 */
export async function assertHasCapability(orgId: string, capability: keyof PlanCapabilities): Promise<GuardResult> {
  const org = await loadOrg(orgId);
  if (PLANS[org.plan].capabilities[capability]) return { allowed: true };
  return {
    allowed: false,
    reason: `This feature requires the Business plan. Ask a workspace admin to upgrade from Billing.`,
  };
}

export async function assertCanInviteMember(orgId: string): Promise<GuardResult> {
  const org = await loadOrg(orgId);
  const limit = PLANS[org.plan].quota.agentSeats + org.addon_seats;
  const used = await getActiveMemberCount(orgId);
  if (used >= limit) {
    return {
      allowed: false,
      reason: `Your ${PLANS[org.plan].name} plan allows up to ${limit} seat(s) (including add-ons). Upgrade or buy an extra seat to invite more teammates.`,
    };
  }
  return { allowed: true };
}
