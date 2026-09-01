import type { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { ChatStreamRequestSchema } from "@velobot/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isOriginAllowed, corsHeaders } from "@/lib/security/origin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getOrCreateConversation, clientIp } from "@/lib/conversations";
import { runChatTurn } from "@/lib/rag/chat-runtime";
import { isOrgSuspended } from "@/lib/organizations";
import { assertCanSendAiMessage, consumeAddonMessage } from "@/lib/billing/guards";
import { listWorkflowRules, matchWorkflowRule, logWorkflowRuleHit } from "@/lib/workflow/workflow-manager";
import { extractConversationData } from "@/lib/analysis/extract-data";

export const runtime = "edge";

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function OPTIONS(req: NextRequest) {
  // No body on a preflight request — can't look up the bot yet, so this
  // stays permissive. See the corsHeaders() doc comment.
  return new Response(null, { status: 204, headers: corsHeaders(req, true) });
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (err) {
    // Any unhandled error here (bad OPENAI_API_KEY, a misconfigured
    // dependency, a Supabase RPC failure, etc.) must still carry CORS
    // headers — the edge runtime's own default error response carries
    // none at all, which the browser reports as a confusing CORS failure
    // that hides the real cause. This path is reached only after truly
    // unexpected errors (never "origin not allowed", which handlePost
    // returns directly), so permissive headers here don't undermine the
    // whitelist — no bot-specific data is in a generic 500.
    console.error("[chat/stream] Unhandled error", err);
    Sentry.captureException(err);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500, headers: corsHeaders(req, true) }
    );
  }
}

async function handlePost(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = ChatStreamRequestSchema.safeParse(json);
  if (!parsed.success) {
    // No bot_id resolved yet — nothing whitelist-worthy to leak either way.
    return Response.json({ error: parsed.error.flatten() }, { status: 400, headers: corsHeaders(req, true) });
  }
  const { bot_id, session_id, message, history, page_url, attachment_url, attachment_type } = parsed.data;

  const admin = createSupabaseAdminClient();
  const { data: bot } = await admin.from("bots").select("*").eq("id", bot_id).maybeSingle();
  if (!bot) return Response.json({ error: "Bot not found" }, { status: 404, headers: corsHeaders(req, true) });

  const originAllowed = isOriginAllowed(bot, req);
  const headers = corsHeaders(req, originAllowed);

  if (!originAllowed) {
    return Response.json({ error: "Origin not allowed for this bot" }, { status: 403, headers });
  }

  if (await isOrgSuspended(bot.org_id)) {
    return Response.json({ error: "This bot is currently unavailable." }, { status: 403, headers });
  }

  const ip = clientIp(req);
  const { allowed: rateLimitAllowed } = await checkRateLimit(ip, bot_id);
  if (!rateLimitAllowed) {
    return Response.json({ error: "Rate limit exceeded. Please slow down." }, { status: 429, headers });
  }

  let conversation = await getOrCreateConversation(bot, session_id, { url: page_url, ip });

  await admin.from("messages").insert({
    conversation_id: conversation.id,
    role: "user",
    content: message,
    attachment_url: attachment_url ?? null,
    attachment_type: attachment_type ?? null,
  });

  // A visitor messaging again after resolution restarts the AI, mirroring
  // how Intercom/Chatbase resume the bot on a new inbound message.
  if (conversation.status === "resolved") {
    const { data: updated } = await admin
      .from("conversations")
      .update({ status: "ai" })
      .eq("id", conversation.id)
      .select()
      .single();
    if (updated) conversation = updated;
  }

  await admin
    .from("conversations")
    .update({
      last_message_at: new Date().toISOString(),
      unread_by_agent: conversation.status !== "ai",
    })
    .eq("id", conversation.id);

  // Deterministic keyword rules run before the model ever sees the
  // message — only while the AI still owns the conversation, never
  // overriding a human who's already on it.
  if (conversation.status === "ai") {
    const rules = await listWorkflowRules(bot.id);
    const matched = matchWorkflowRule(rules, message);
    if (matched) {
      logWorkflowRuleHit(matched, bot.id, conversation.id);
      if (matched.action_type === "escalate") {
        await admin
          .from("conversations")
          .update({
            status: "queued",
            queued_at: new Date().toISOString(),
            unread_by_agent: true,
            queue_id: bot.queue_id,
          })
          .eq("id", conversation.id);
        await admin.from("messages").insert({
          conversation_id: conversation.id,
          role: "system",
          content: `Workflow rule "${matched.name}" escalated this conversation to a human agent.`,
        });
        if (matched.action_value) {
          await admin.from("messages").insert({ conversation_id: conversation.id, role: "assistant", content: matched.action_value });
        }

        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(sse("meta", { conversationId: conversation.id })));
            if (matched.action_value) controller.enqueue(encoder.encode(sse("token", { token: matched.action_value })));
            controller.enqueue(encoder.encode(sse("human_mode", { status: "queued" })));
            controller.close();
          },
        });
        return new Response(stream, {
          headers: { ...headers, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      }

      // canned_reply — skip the LLM entirely for this turn.
      const replyText = matched.action_value ?? "";
      await admin.from("messages").insert({ conversation_id: conversation.id, role: "assistant", content: replyText });
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(sse("meta", { conversationId: conversation.id })));
          controller.enqueue(encoder.encode(sse("token", { token: replyText })));
          controller.enqueue(encoder.encode(sse("done", { fallback: false })));
          controller.close();
        },
      });
      return new Response(stream, {
        headers: { ...headers, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    }
  }

  // Once a human has the conversation, the AI must stay silent — the
  // widget switches to listening on Supabase Realtime for the agent's
  // reply instead (see apps/widget/src/realtime.ts).
  if (conversation.status === "queued" || conversation.status === "assigned") {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(sse("meta", { conversationId: conversation.id })));
        controller.enqueue(encoder.encode(sse("human_mode", { status: conversation.status })));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { ...headers, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  const messageGuard = await assertCanSendAiMessage(bot.org_id);
  if (!messageGuard.allowed) {
    // A blocked message still gets a normal-looking bot reply in the
    // widget (persisted like any other assistant message) rather than a
    // raw error the chat UI can't render gracefully.
    await admin.from("messages").insert({ conversation_id: conversation.id, role: "assistant", content: messageGuard.reason! });
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(sse("meta", { conversationId: conversation.id })));
        controller.enqueue(encoder.encode(sse("token", { token: messageGuard.reason })));
        controller.enqueue(encoder.encode(sse("done", { fallback: false })));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { ...headers, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullText = "";
      try {
        controller.enqueue(encoder.encode(sse("meta", { conversationId: conversation.id })));
        for await (const event of runChatTurn(bot, message, history)) {
          if (event.type === "token") {
            controller.enqueue(encoder.encode(sse("token", { token: event.token })));
          } else if (event.type === "tool_call") {
            controller.enqueue(encoder.encode(sse("tool_call", { name: event.name })));
          } else if (event.type === "tool_result") {
            controller.enqueue(encoder.encode(sse("tool_result", { name: event.name, ok: event.ok })));
          } else if (event.type === "done") {
            fullText = event.fullText;
            controller.enqueue(encoder.encode(sse("done", { fallback: event.fallback })));
          }
        }
        await admin.from("messages").insert({ conversation_id: conversation.id, role: "assistant", content: fullText });
        await admin.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversation.id);
        if (messageGuard.usesAddonBalance) await consumeAddonMessage(bot.org_id);
        // Awaited (not truly backgrounded) since the edge runtime can kill
        // an un-awaited promise once the response stream closes — but this
        // runs after the visitor's "done" event is already enqueued above,
        // so it adds no perceived latency to the chat itself. The function
        // is fully self-contained (catches its own errors) so it can never
        // fail this request.
        if (bot.data_extraction_enabled) await extractConversationData(bot, conversation, message, history);
      } catch (err) {
        Sentry.captureException(err);
        controller.enqueue(encoder.encode(sse("error", { message: "Something went wrong. Please try again." })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { ...headers, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}
