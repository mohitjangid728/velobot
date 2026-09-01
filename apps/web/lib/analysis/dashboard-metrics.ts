import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface DailyVolume {
  date: string; // "YYYY-MM-DD"
  count: number;
}

/** Client-side-bucketed rather than a SQL date_trunc RPC — org conversation volume is modest enough that fetching timestamps and bucketing in JS is simpler than shipping a new Postgres function, per the same "derive, don't cache" convention as lib/billing/usage.ts. Revisit with a real RPC if this ever shows up in a perf profile. */
export async function getConversationVolumeByDay(orgId: string, days = 14): Promise<DailyVolume[]> {
  const admin = createSupabaseAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data } = await admin.from("conversations").select("created_at").eq("org_id", orgId).gte("created_at", since.toISOString());

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of data ?? []) {
    const key = row.created_at.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
}

export interface DeflectionRate {
  resolvedByAi: number;
  resolvedByHuman: number;
  rate: number; // 0-1, resolvedByAi / (resolvedByAi + resolvedByHuman)
}

/** A conversation that reached "resolved" without ever having a queued_at/assigned_at timestamp never left the AI — that's the deflection signal, without needing a dedicated "escalated" flag. */
export async function getDeflectionRate(orgId: string): Promise<DeflectionRate> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("conversations")
    .select("queued_at")
    .eq("org_id", orgId)
    .eq("status", "resolved");

  const rows = data ?? [];
  const resolvedByAi = rows.filter((r) => !r.queued_at).length;
  const resolvedByHuman = rows.length - resolvedByAi;
  const total = resolvedByAi + resolvedByHuman;
  return { resolvedByAi, resolvedByHuman, rate: total > 0 ? resolvedByAi / total : 0 };
}

export interface SentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
}

/** Only over conversations that actually have a sentiment (data_extraction_enabled + a real user turn) — never treats "no data" as neutral. */
export async function getSentimentBreakdown(orgId: string): Promise<SentimentBreakdown> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("conversations").select("extracted_sentiment").eq("org_id", orgId).not("extracted_sentiment", "is", null);

  const breakdown: SentimentBreakdown = { positive: 0, neutral: 0, negative: 0 };
  for (const row of data ?? []) {
    if (row.extracted_sentiment && row.extracted_sentiment in breakdown) {
      breakdown[row.extracted_sentiment as keyof SentimentBreakdown]++;
    }
  }
  return breakdown;
}

export interface TopIntent {
  intent: string;
  count: number;
}

export async function getTopIntents(orgId: string, limit = 5): Promise<TopIntent[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("conversations").select("extracted_intent").eq("org_id", orgId).not("extracted_intent", "is", null);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    if (row.extracted_intent) counts.set(row.extracted_intent, (counts.get(row.extracted_intent) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([intent, count]) => ({ intent, count }));
}

/** Average of every submitted 1-5 rating for the org, or null if there are none yet — never shown as "0" (a real, damning score) when the true state is "no data". */
export async function getAverageRating(orgId: string): Promise<{ average: number; count: number } | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("conversation_ratings").select("score").eq("org_id", orgId);
  const rows = data ?? [];
  if (rows.length === 0) return null;
  return { average: rows.reduce((sum, r) => sum + r.score, 0) / rows.length, count: rows.length };
}
