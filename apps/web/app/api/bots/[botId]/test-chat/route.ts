import type { NextRequest } from "next/server";
import { TestChatRequestSchema } from "@velobot/shared";
import { requireBotAccess } from "@/lib/auth/bot-guard";
import { runChatTurn } from "@/lib/rag/chat-runtime";

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Session-authenticated "test this bot" panel in the dashboard — same
 * retrieve + tool-calling pipeline as the public widget endpoint
 * (app/api/chat/stream, via lib/rag/chat-runtime) but gated by dashboard
 * auth instead of origin whitelisting, and deliberately NOT persisted to
 * conversations/messages — this is a sandbox for the bot owner, not a real
 * visitor conversation, so it shouldn't show up in the agent inbox or
 * count toward usage. Any Bot Actions the bot has configured (including
 * their real HTTP execution) run exactly as they would for a live visitor.
 */
export async function POST(req: NextRequest, { params }: { params: { botId: string } }) {
  const guard = await requireBotAccess(params.botId, "admin");
  if (!guard.ok) return guard.response;

  const parsed = TestChatRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { message, history } = parsed.data;

  try {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of runChatTurn(guard.bot, message, history)) {
            if (event.type === "token") {
              controller.enqueue(encoder.encode(sse("token", { token: event.token })));
            } else if (event.type === "tool_call") {
              controller.enqueue(encoder.encode(sse("tool_call", { name: event.name })));
            } else if (event.type === "tool_result") {
              controller.enqueue(encoder.encode(sse("tool_result", { name: event.name, ok: event.ok })));
            } else if (event.type === "done") {
              controller.enqueue(encoder.encode(sse("done", { fallback: event.fallback })));
            }
          }
        } catch {
          controller.enqueue(encoder.encode(sse("error", { message: "Something went wrong. Please try again." })));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (err) {
    console.error("[test-chat] Unhandled error", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
