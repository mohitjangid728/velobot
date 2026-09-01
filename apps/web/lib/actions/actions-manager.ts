import "server-only";
import type OpenAI from "openai";
import type { BotAction, Connection, CreateActionInput, UpdateActionInput, ActionParameter } from "@velobot/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ActionWithBotIds = BotAction & { bot_ids: string[] };

async function attachBotIds(actions: BotAction[]): Promise<ActionWithBotIds[]> {
  if (actions.length === 0) return [];
  const admin = createSupabaseAdminClient();
  const { data: links } = await admin
    .from("bot_action_links")
    .select("action_id, bot_id")
    .in(
      "action_id",
      actions.map((a) => a.id)
    );

  const grouped = new Map<string, string[]>();
  for (const link of links ?? []) {
    const arr = grouped.get(link.action_id) ?? [];
    arr.push(link.bot_id);
    grouped.set(link.action_id, arr);
  }
  return actions.map((a) => ({ ...a, bot_ids: grouped.get(a.id) ?? [] }));
}

/** Full-replace semantics — same convention as `allowed_domains` elsewhere in this app. */
async function setBotLinks(actionId: string, botIds: string[]): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from("bot_action_links").delete().eq("action_id", actionId);
  if (botIds.length > 0) {
    await admin.from("bot_action_links").insert(botIds.map((bot_id) => ({ bot_id, action_id: actionId })));
  }
}

export async function listActions(orgId: string): Promise<ActionWithBotIds[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("bot_actions").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
  return attachBotIds((data ?? []) as BotAction[]);
}

export async function getAction(orgId: string, id: string): Promise<ActionWithBotIds | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("bot_actions").select("*").eq("org_id", orgId).eq("id", id).maybeSingle();
  if (!data) return null;
  const [withLinks] = await attachBotIds([data as BotAction]);
  return withLinks!;
}

export async function createAction(orgId: string, input: CreateActionInput): Promise<ActionWithBotIds> {
  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin.from("bot_actions").select("id").eq("org_id", orgId).eq("name", input.name).maybeSingle();
  if (existing) throw new Error(`An action named "${input.name}" already exists in this workspace`);

  const { bot_ids, ...rest } = input;
  const { data, error } = await admin.from("bot_actions").insert({ org_id: orgId, ...rest }).select().single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create action");

  await setBotLinks(data.id, bot_ids);
  return { ...(data as BotAction), bot_ids };
}

export async function updateAction(orgId: string, id: string, input: UpdateActionInput): Promise<ActionWithBotIds> {
  const admin = createSupabaseAdminClient();
  if (input.name) {
    const { data: existing } = await admin
      .from("bot_actions")
      .select("id")
      .eq("org_id", orgId)
      .eq("name", input.name)
      .neq("id", id)
      .maybeSingle();
    if (existing) throw new Error(`An action named "${input.name}" already exists in this workspace`);
  }

  const { bot_ids, ...rest } = input;
  const { data, error } = await admin
    .from("bot_actions")
    .update({ ...rest, updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("id", id)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to update action");

  if (bot_ids !== undefined) await setBotLinks(id, bot_ids);
  const [withLinks] = await attachBotIds([data as BotAction]);
  return withLinks!;
}

export async function deleteAction(orgId: string, id: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from("bot_action_links").delete().eq("action_id", id);
  await admin.from("bot_actions").delete().eq("org_id", orgId).eq("id", id);
}

function parametersToJsonSchema(parameters: ActionParameter[]) {
  const properties: Record<string, { type: string; description: string }> = {};
  const required: string[] = [];
  for (const param of parameters) {
    properties[param.name] = { type: param.type, description: param.description };
    if (param.required) required.push(param.name);
  }
  return { type: "object" as const, properties, required };
}

export interface ActiveAction {
  action: BotAction;
  connection: Connection;
  tool: OpenAI.Chat.ChatCompletionTool;
}

/**
 * Active actions offered to this specific bot — resolved through
 * `bot_action_links` (an org-scoped action can be linked to several bots),
 * then joined to its (also active) connection. An action whose connection
 * was switched to Draft, or that isn't linked to this bot, silently drops
 * out here — no special-casing needed elsewhere.
 */
export async function getActiveToolsForBot(botId: string): Promise<ActiveAction[]> {
  const admin = createSupabaseAdminClient();
  const { data: links } = await admin.from("bot_action_links").select("action_id").eq("bot_id", botId);
  const actionIds = (links ?? []).map((l) => l.action_id);
  if (actionIds.length === 0) return [];

  const { data } = await admin
    .from("bot_actions")
    .select("*, connections!inner(*)")
    .in("id", actionIds)
    .eq("is_active", true)
    .eq("connections.is_active", true);

  return ((data ?? []) as (BotAction & { connections: Connection })[]).map((row) => {
    const { connections: connection, ...action } = row;
    return {
      action,
      connection,
      tool: {
        type: "function",
        function: {
          name: action.name,
          description: action.trigger_description,
          parameters: parametersToJsonSchema(action.parameters),
        },
      },
    };
  });
}
