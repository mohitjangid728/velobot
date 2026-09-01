import type { WidgetConfig } from "./types";

const API_BASE = __VELOBOT_API_BASE__;

export async function fetchWidgetConfig(botId: string): Promise<WidgetConfig> {
  const res = await fetch(`${API_BASE}/api/widget-config/${botId}`);
  if (!res.ok) throw new Error("Failed to load bot configuration");
  return res.json();
}

export interface StreamEvent {
  event: "meta" | "token" | "done" | "human_mode" | "error";
  data: any;
}

/** Parses the fetch response body as an SSE stream, yielding one event per `data:` line. */
async function* parseSSE(response: Response): AsyncGenerator<StreamEvent> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      const eventLine = lines.find((l) => l.startsWith("event:"));
      const dataLine = lines.find((l) => l.startsWith("data:"));
      if (!eventLine || !dataLine) continue;
      const event = eventLine.slice(6).trim() as StreamEvent["event"];
      try {
        yield { event, data: JSON.parse(dataLine.slice(5).trim()) };
      } catch {
        // malformed chunk — skip rather than crash the whole stream
      }
    }
  }
}

export function streamChat(params: {
  botId: string;
  sessionId: string;
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  attachmentUrl?: string | null;
  attachmentType?: string | null;
}): AsyncGenerator<StreamEvent> {
  const controller = new AbortController();
  const responsePromise = fetch(`${API_BASE}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bot_id: params.botId,
      session_id: params.sessionId,
      message: params.message,
      history: params.history,
      page_url: window.location.href,
      attachment_url: params.attachmentUrl ?? undefined,
      attachment_type: params.attachmentType ?? undefined,
    }),
    signal: controller.signal,
  });

  async function* run() {
    const res = await responsePromise;
    if (!res.ok) {
      yield { event: "error" as const, data: { message: "Could not reach the bot." } };
      return;
    }
    yield* parseSSE(res);
  }

  return run();
}

export async function fetchHistory(botId: string, sessionId: string) {
  const res = await fetch(`${API_BASE}/api/chat/history?bot_id=${botId}&session_id=${sessionId}`);
  if (!res.ok) return { conversationId: null, status: "ai" as const, messages: [] };
  return res.json() as Promise<{
    conversationId: string | null;
    status: "ai" | "queued" | "assigned" | "resolved";
    messages: { id: string; role: string; content: string; attachment_url: string | null; attachment_type: string | null; created_at: string }[];
  }>;
}

export async function escalateToHuman(params: { botId: string; sessionId: string; visitorEmail?: string | null }) {
  const res = await fetch(`${API_BASE}/api/chat/escalate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bot_id: params.botId,
      session_id: params.sessionId,
      visitor_email: params.visitorEmail ?? null,
      page_url: window.location.href,
    }),
  });
  if (!res.ok) throw new Error("Could not request a human agent");
  return res.json() as Promise<{ status: string; agentsOnline: boolean; conversationId: string }>;
}

export async function captureOfflineMessage(params: {
  botId: string;
  sessionId: string;
  visitorEmail: string;
  message: string;
}) {
  const res = await fetch(`${API_BASE}/api/chat/offline-capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bot_id: params.botId,
      session_id: params.sessionId,
      visitor_email: params.visitorEmail,
      message: params.message,
    }),
  });
  if (!res.ok) throw new Error("Could not send your message");
  return res.json() as Promise<{ ok: true; conversationId: string }>;
}

export async function submitRating(params: { botId: string; sessionId: string; score: number; comment?: string | null }) {
  const res = await fetch(`${API_BASE}/api/chat/rating`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bot_id: params.botId,
      session_id: params.sessionId,
      score: params.score,
      comment: params.comment ?? null,
    }),
  });
  if (!res.ok) throw new Error("Could not submit your rating");
  return res.json() as Promise<{ ok: true }>;
}

/** The only multipart/FormData call in the widget — every other request here is JSON. */
export async function uploadAttachment(params: { botId: string; sessionId: string; file: File }) {
  const form = new FormData();
  form.append("bot_id", params.botId);
  form.append("session_id", params.sessionId);
  form.append("file", params.file);
  const res = await fetch(`${API_BASE}/api/chat/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error("Could not upload the file");
  return res.json() as Promise<{ url: string; type: string }>;
}
