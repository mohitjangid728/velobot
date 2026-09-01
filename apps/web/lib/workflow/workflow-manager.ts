import "server-only";
import type { WorkflowRule, CreateWorkflowRuleInput, UpdateWorkflowRuleInput } from "@velobot/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function listWorkflowRules(botId: string): Promise<WorkflowRule[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("bot_workflow_rules").select("*").eq("bot_id", botId).order("position", { ascending: true });
  return (data ?? []) as WorkflowRule[];
}

export async function createWorkflowRule(botId: string, input: CreateWorkflowRuleInput): Promise<WorkflowRule> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("bot_workflow_rules").insert({ bot_id: botId, ...input }).select().single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create workflow rule");
  return data as WorkflowRule;
}

export async function updateWorkflowRule(botId: string, ruleId: string, input: UpdateWorkflowRuleInput): Promise<WorkflowRule> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("bot_workflow_rules")
    .update(input)
    .eq("id", ruleId)
    .eq("bot_id", botId)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to update workflow rule");
  return data as WorkflowRule;
}

export async function deleteWorkflowRule(botId: string, ruleId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from("bot_workflow_rules").delete().eq("id", ruleId).eq("bot_id", botId);
}

/** Case-insensitive substring match against any comma-separated keyword in the rule's trigger_value — first enabled match wins, in `position` order. */
export function matchWorkflowRule(rules: WorkflowRule[], message: string): WorkflowRule | null {
  const lower = message.toLowerCase();
  const sorted = [...rules].filter((r) => r.enabled).sort((a, b) => a.position - b.position);
  for (const rule of sorted) {
    const keywords = rule.trigger_value
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
    if (keywords.some((k) => lower.includes(k))) return rule;
  }
  return null;
}

/** Fire-and-forget from the hot chat path — a logging failure must never break the actual escalate/canned_reply response the visitor is waiting on. */
export function logWorkflowRuleHit(rule: WorkflowRule, botId: string, conversationId: string): void {
  const admin = createSupabaseAdminClient();
  void admin
    .from("bot_workflow_rule_hits")
    .insert({ rule_id: rule.id, bot_id: botId, conversation_id: conversationId, action_type: rule.action_type })
    .then(({ error }) => {
      if (error) console.error("[workflow-manager] Failed to log rule hit", error);
    });
}

export interface WorkflowRuleHitStats {
  ruleId: string;
  count: number;
  lastFiredAt: string | null;
}

/** One row per rule that has fired at least once — a rule with zero hits simply doesn't appear, callers default to {count:0, lastFiredAt:null}. */
export async function getWorkflowRuleHitStats(botId: string): Promise<Map<string, WorkflowRuleHitStats>> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("bot_workflow_rule_hits").select("rule_id, created_at").eq("bot_id", botId);

  const stats = new Map<string, WorkflowRuleHitStats>();
  for (const row of data ?? []) {
    const existing = stats.get(row.rule_id) ?? { ruleId: row.rule_id, count: 0, lastFiredAt: null };
    existing.count++;
    if (!existing.lastFiredAt || row.created_at > existing.lastFiredAt) existing.lastFiredAt = row.created_at;
    stats.set(row.rule_id, existing);
  }
  return stats;
}
