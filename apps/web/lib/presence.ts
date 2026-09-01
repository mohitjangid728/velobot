import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** An agent counts as online if they've heartbeated in the last 45s (2x the client's 20s interval). */
export const PRESENCE_STALE_AFTER_SECONDS = 45;

export async function anyAgentsOnline(orgId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const cutoff = new Date(Date.now() - PRESENCE_STALE_AFTER_SECONDS * 1000).toISOString();
  const { count } = await admin
    .from("agent_presence")
    .select("user_id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "online")
    .gte("last_seen_at", cutoff);
  return (count ?? 0) > 0;
}
