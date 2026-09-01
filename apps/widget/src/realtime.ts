import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (!__VELOBOT_SUPABASE_URL__ || !__VELOBOT_SUPABASE_ANON_KEY__) {
    console.warn("[velobot] Supabase URL/anon key not configured at build time — human-mode live updates disabled.");
    return null;
  }
  if (!client) client = createClient(__VELOBOT_SUPABASE_URL__, __VELOBOT_SUPABASE_ANON_KEY__);
  return client;
}

export interface AgentMessagePayload {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

/**
 * Subscribes to new rows on `messages` for one conversation over a
 * Supabase Realtime (WebSocket) channel — this satisfies the widget's
 * "real-time listener for incoming human agent messages via WebSockets"
 * requirement without a bespoke WS server. Requires RLS on `messages` to
 * permit anonymous SELECT scoped appropriately (see docs/SECURITY.md — the
 * conversation id functions as an unguessable capability token here).
 */
export function subscribeToConversation(
  conversationId: string,
  onMessage: (message: AgentMessagePayload) => void,
  onStatusChange: (status: string) => void
): () => void {
  const supabase = getClient();
  if (!supabase) return () => {};

  const channel: RealtimeChannel = supabase
    .channel(`widget:conversation:${conversationId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (payload) => {
        const row = payload.new as AgentMessagePayload;
        if (row.role === "agent" || row.role === "system") onMessage(row);
      }
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "conversations", filter: `id=eq.${conversationId}` },
      (payload) => {
        const row = payload.new as { status: string };
        if (row.status) onStatusChange(row.status);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ── Typing indicator ─────────────────────────────────────────────────────
// A separate, ephemeral Broadcast channel (not tied to any table) — typing
// state is never persisted, so postgres_changes doesn't apply here. Kept
// independent of subscribeToConversation()'s channel so sending a typing
// signal doesn't depend on whether the message/status subscription happens
// to be active.
let typingChannel: RealtimeChannel | null = null;
let typingChannelConversationId: string | null = null;

function getTypingChannel(conversationId: string): RealtimeChannel | null {
  const supabase = getClient();
  if (!supabase) return null;

  if (typingChannel && typingChannelConversationId !== conversationId) {
    supabase.removeChannel(typingChannel);
    typingChannel = null;
  }
  if (!typingChannel) {
    typingChannel = supabase.channel(`typing:${conversationId}`);
    typingChannel.subscribe();
    typingChannelConversationId = conversationId;
  }
  return typingChannel;
}

/** Broadcasts the visitor's typing state to anyone (the agent inbox) listening on this conversation. */
export function sendTypingSignal(conversationId: string, isTyping: boolean) {
  const channel = getTypingChannel(conversationId);
  channel?.send({ type: "broadcast", event: "typing", payload: { isTyping, role: "user" } });
}
