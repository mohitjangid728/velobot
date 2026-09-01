import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import type { Bot, Conversation } from "@velobot/shared";

/** Finds the widget's conversation for this session, creating one on first contact. */
export async function getOrCreateConversation(
  bot: Bot,
  sessionId: string,
  visitor: { url?: string; ip?: string }
): Promise<Conversation> {
  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from("conversations")
    .select("*")
    .eq("bot_id", bot.id)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (existing) return existing as Conversation;

  const { data: created, error } = await admin
    .from("conversations")
    .insert({
      bot_id: bot.id,
      org_id: bot.org_id,
      session_id: sessionId,
      status: "ai",
      visitor_url: visitor.url ?? null,
      visitor_ip: visitor.ip ?? null,
      last_message_at: new Date().toISOString(),
      unread_by_agent: false,
    })
    .select()
    .single();

  if (error || !created) throw error ?? new Error("Failed to create conversation");

  // Fire-and-forget, and only on the rare "brand new conversation" path
  // (not every message) — an extra count query per new visitor is cheap
  // compared to running it on every chat turn.
  const { count } = await admin.from("conversations").select("id", { count: "exact", head: true }).eq("org_id", bot.org_id);
  if (count === 1) trackServerEvent(bot.org_id, "first_embed_detected", { bot_id: bot.id });

  return created as Conversation;
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}
