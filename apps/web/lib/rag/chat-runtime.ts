import "server-only";
import type OpenAI from "openai";
import type { Bot } from "@velobot/shared";
import { retrieveContext } from "@/lib/rag/retrieve";
import { rewriteQueryForRetrieval } from "@/lib/rag/rewrite-query";
import { buildSystemPrompt, FALLBACK_PHRASE } from "@/lib/rag/system-prompt";
import { getOpenAI } from "@/lib/openai/client";
import { getActiveToolsForBot, type ActiveAction } from "@/lib/actions/actions-manager";
import { getConnection } from "@/lib/connections/connections-manager";
import { executeAction, truncateForModel } from "@/lib/actions/executeAction";
import { redactSensitiveNumbers } from "@/lib/security/pii-redaction";

/** Response-length preference maps to a hard token ceiling on top of the prompt-level style guidance in system-prompt.ts — belt and suspenders against a model that ignores the style instruction. */
const MAX_TOKENS_BY_LENGTH: Record<Bot["llm_response_length"], number> = {
  concise: 200,
  balanced: 500,
  detailed: 1000,
};

export interface RagChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type ChatRuntimeEvent =
  | { type: "token"; token: string }
  | { type: "tool_call"; name: string }
  | { type: "tool_result"; name: string; ok: boolean }
  | { type: "done"; fullText: string; fallback: boolean };

/** Hard cap on tool-calling hops — the final allowed hop always omits `tools`, forcing a plain-text reply and guaranteeing termination. */
const MAX_TOOL_HOPS = 3;

interface AccumulatedToolCall {
  id: string;
  name: string;
  arguments: string;
}

/**
 * The single AI chat entry point: retrieve → build the guardrailed system
 * prompt → stream a completion, now with an optional tool-calling loop on
 * top when the bot has active Bot Actions. A bot with zero active actions
 * never sends a `tools` array at all, so its request/behavior is identical
 * to the pre-Actions-Engine RAG-only pipeline.
 *
 * Callers own their own SSE framing (see app/api/chat/stream/route.ts and
 * app/api/bots/[botId]/test-chat/route.ts) — this just yields events.
 */
export async function* runChatTurn(
  bot: Bot,
  message: string,
  history: RagChatMessage[]
): AsyncGenerator<ChatRuntimeEvent> {
  const rewritten = await rewriteQueryForRetrieval(message, history);
  const chunks = await retrieveContext(bot.id, rewritten);

  const activeActions = await getActiveToolsForBot(bot.id);
  const actionsByName = new Map<string, ActiveAction>(activeActions.map((a) => [a.action.name, a]));
  const tools: OpenAI.Chat.ChatCompletionTool[] = activeActions.map((a) => a.tool);

  const systemPrompt = buildSystemPrompt(
    bot,
    chunks,
    activeActions.map((a) => ({ name: a.action.name, trigger_description: a.action.trigger_description }))
  );

  const openai = getOpenAI();
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({ role: h.role, content: h.content }) as const),
    { role: "user", content: message },
  ];

  let fullText = "";

  for (let hop = 0; hop <= MAX_TOOL_HOPS; hop++) {
    const includeTools = tools.length > 0 && hop < MAX_TOOL_HOPS;

    const stream = await openai.chat.completions.create({
      // `?? defaults` guard against a bot row fetched before migration
      // 008 (guardrails/llm/extraction columns) has been applied — without
      // this, an old row would send `model: undefined` to OpenAI and break
      // every chat on the site, not just degrade gracefully.
      model: bot.llm_model ?? "gpt-4o-mini",
      stream: true,
      temperature: bot.llm_temperature ?? 0.3,
      max_tokens: MAX_TOKENS_BY_LENGTH[bot.llm_response_length] ?? MAX_TOKENS_BY_LENGTH.balanced,
      messages,
      ...(includeTools ? { tools, tool_choice: "auto" as const } : {}),
    });

    let hopText = "";
    let finishReason: string | null = null;
    const toolCallAccum = new Map<number, AccumulatedToolCall>();

    for await (const part of stream) {
      const choice = part.choices[0];
      if (!choice) continue;
      finishReason = choice.finish_reason ?? finishReason;

      if (choice.delta?.content) {
        hopText += choice.delta.content;
        fullText += choice.delta.content;
        yield { type: "token", token: choice.delta.content };
      }

      for (const tc of choice.delta?.tool_calls ?? []) {
        const entry = toolCallAccum.get(tc.index) ?? { id: "", name: "", arguments: "" };
        if (tc.id) entry.id = tc.id;
        if (tc.function?.name) entry.name += tc.function.name;
        if (tc.function?.arguments) entry.arguments += tc.function.arguments;
        toolCallAccum.set(tc.index, entry);
      }
    }

    if (!includeTools || finishReason !== "tool_calls" || toolCallAccum.size === 0) {
      break;
    }

    const toolCalls = [...toolCallAccum.values()];
    messages.push({
      role: "assistant",
      content: hopText || null,
      tool_calls: toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: tc.arguments },
      })),
    });

    for (const tc of toolCalls) {
      yield { type: "tool_call", name: tc.name };
      const resultContent = await runToolCall(bot, actionsByName, tc);
      yield { type: "tool_result", name: tc.name, ok: resultContent.ok };
      messages.push({ role: "tool", tool_call_id: tc.id, content: resultContent.content });
    }
  }

  // Redaction only affects what gets persisted from here on (the caller
  // stores `event.fullText`) — the visitor already saw the live token
  // stream above by this point, so this is a storage-side safety net, not
  // a live-stream filter. See lib/security/pii-redaction.ts's doc comment.
  const storedText = bot.guardrails_pii_redaction_enabled ? redactSensitiveNumbers(fullText) : fullText;
  yield { type: "done", fullText: storedText, fallback: fullText.trim() === FALLBACK_PHRASE };
}

async function runToolCall(
  bot: Bot,
  actionsByName: Map<string, ActiveAction>,
  toolCall: AccumulatedToolCall
): Promise<{ ok: boolean; content: string }> {
  const active = actionsByName.get(toolCall.name);
  if (!active) {
    return { ok: false, content: JSON.stringify({ error: `Unknown action "${toolCall.name}".` }) };
  }

  let params: Record<string, string | number | boolean>;
  try {
    params = toolCall.arguments ? JSON.parse(toolCall.arguments) : {};
  } catch {
    return { ok: false, content: JSON.stringify({ error: "Could not parse the extracted parameters as JSON." }) };
  }

  const missing = active.action.parameters.filter((p) => p.required && (params[p.name] === undefined || params[p.name] === ""));
  if (missing.length > 0) {
    return {
      ok: false,
      content: JSON.stringify({ error: `Missing required parameter(s): ${missing.map((p) => p.name).join(", ")}. Ask the user for this information.` }),
    };
  }

  // Re-fetch the connection fresh rather than trusting a cached copy from
  // the start of the turn — a long tool-calling conversation could in
  // theory span an admin flipping the connection to Draft mid-turn.
  const connection = await getConnection(bot.org_id, active.connection.id);
  if (!connection || !connection.is_active) {
    return { ok: false, content: JSON.stringify({ error: "This action's connection is currently unavailable. Apologize and offer to connect the user with a human agent." }) };
  }

  const result = await executeAction({ action: active.action, connection, params, source: "ai" });
  if (!result.ok) {
    return {
      ok: false,
      content: JSON.stringify({
        error: "This service is temporarily unavailable. Apologize to the user and offer to connect them with a human support agent.",
        detail: result.error,
      }),
    };
  }

  return { ok: true, content: truncateForModel({ status: result.status, data: result.body }) };
}
