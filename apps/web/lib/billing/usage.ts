import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Organization } from "@velobot/shared";

/**
 * Free-tier orgs have no Razorpay subscription, so no `current_period_start`
 * — their "month" is just the current calendar month (UTC). Paid orgs use
 * their actual Razorpay billing period, kept in sync by the webhook
 * (subscription.activated / subscription.charged — see
 * app/api/razorpay/webhook/route.ts).
 */
export function getPeriodStart(org: Pick<Organization, "current_period_start">): Date {
  if (org.current_period_start) return new Date(org.current_period_start);
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Derived, not stored — counts real `messages` rows rather than a mutable
 * counter, so it can never drift from reality. Relies on the
 * messages.conversation_id → conversations.id and
 * conversations.org_id foreign keys for the embedded-resource filter.
 */
export async function getMessagesUsedThisPeriod(orgId: string, periodStart: Date): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { count } = await admin
    .from("messages")
    .select("id, conversations!inner(org_id)", { count: "exact", head: true })
    .eq("role", "assistant")
    .eq("conversations.org_id", orgId)
    .gte("created_at", periodStart.toISOString());
  return count ?? 0;
}

/** Derived from knowledge_sources.pages_crawled across every bot in the org — no separate counter to keep in sync. */
export async function getPagesIndexed(orgId: string): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("knowledge_sources").select("pages_crawled, bots!inner(org_id)").eq("bots.org_id", orgId);
  return (data ?? []).reduce((sum, row) => sum + (row.pages_crawled ?? 0), 0);
}

export async function getBotCount(orgId: string): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { count } = await admin.from("bots").select("id", { count: "exact", head: true }).eq("org_id", orgId);
  return count ?? 0;
}

export async function getActiveMemberCount(orgId: string): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { count } = await admin
    .from("org_members")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "active");
  return count ?? 0;
}

export interface UsageSummary {
  bots: number;
  pages: number;
  messagesThisPeriod: number;
  seats: number;
  periodStart: Date;
}

/** Everything the billing panel and the quota guards need, in one round-trip-friendly bundle. */
export async function getUsageSummary(org: Organization): Promise<UsageSummary> {
  const periodStart = getPeriodStart(org);
  const [bots, pages, messagesThisPeriod, seats] = await Promise.all([
    getBotCount(org.id),
    getPagesIndexed(org.id),
    getMessagesUsedThisPeriod(org.id, periodStart),
    getActiveMemberCount(org.id),
  ]);
  return { bots, pages, messagesThisPeriod, seats, periodStart };
}
