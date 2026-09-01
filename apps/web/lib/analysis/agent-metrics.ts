import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface AgentWorkload {
  userId: string;
  resolvedCount: number;
  /** Minutes, averaged over resolved_at - assigned_at for that agent's resolved conversations with both timestamps set. Null when there's not enough data yet. */
  avgResolutionMinutes: number | null;
}

/** One row per agent who has ever been assigned a conversation in this org — not just currently-active org_members, so a departed agent's historical numbers still show up correctly attributed rather than disappearing. */
export async function getAgentWorkload(orgId: string): Promise<AgentWorkload[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("conversations")
    .select("assigned_agent_id, assigned_at, resolved_at")
    .eq("org_id", orgId)
    .eq("status", "resolved")
    .not("assigned_agent_id", "is", null);

  const byAgent = new Map<string, { resolvedCount: number; totalMinutes: number; withDuration: number }>();
  for (const row of data ?? []) {
    if (!row.assigned_agent_id) continue;
    const entry = byAgent.get(row.assigned_agent_id) ?? { resolvedCount: 0, totalMinutes: 0, withDuration: 0 };
    entry.resolvedCount++;
    if (row.assigned_at && row.resolved_at) {
      const minutes = (new Date(row.resolved_at).getTime() - new Date(row.assigned_at).getTime()) / 60000;
      if (minutes >= 0) {
        entry.totalMinutes += minutes;
        entry.withDuration++;
      }
    }
    byAgent.set(row.assigned_agent_id, entry);
  }

  return [...byAgent.entries()]
    .map(([userId, e]) => ({
      userId,
      resolvedCount: e.resolvedCount,
      avgResolutionMinutes: e.withDuration > 0 ? e.totalMinutes / e.withDuration : null,
    }))
    .sort((a, b) => b.resolvedCount - a.resolvedCount);
}
