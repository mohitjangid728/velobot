import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isOriginAllowed, corsHeaders } from "@/lib/security/origin";

export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  // A plain GET with no custom headers never actually triggers a browser
  // preflight, but this stays permissive for parity with the other
  // widget-facing routes' OPTIONS handlers. See the corsHeaders() doc
  // comment.
  return new Response(null, { status: 204, headers: corsHeaders(req, true) });
}

/**
 * Public, origin-checked endpoint the widget calls on load to replay a
 * conversation after a page reload. The session_id (an unguessable UUID
 * generated client-side and never exposed elsewhere) functions as the
 * visitor's capability token — see docs/SECURITY.md.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const botId = searchParams.get("bot_id");
  const sessionId = searchParams.get("session_id");
  if (!botId || !sessionId) {
    return Response.json(
      { error: "bot_id and session_id are required" },
      { status: 400, headers: corsHeaders(req, true) }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: bot } = await admin.from("bots").select("*").eq("id", botId).maybeSingle();
  if (!bot) return Response.json({ error: "Bot not found" }, { status: 404, headers: corsHeaders(req, true) });

  const allowed = isOriginAllowed(bot, req);
  const headers = corsHeaders(req, allowed);
  if (!allowed) return Response.json({ error: "Origin not allowed" }, { status: 403, headers });

  const { data: conversation } = await admin
    .from("conversations")
    .select("id, status")
    .eq("bot_id", botId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (!conversation) return Response.json({ conversationId: null, status: "ai", messages: [] }, { headers });

  const { data: messages } = await admin
    .from("messages")
    .select("id, role, content, attachment_url, attachment_type, created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .limit(100);

  return Response.json(
    { conversationId: conversation.id, status: conversation.status, messages: messages ?? [] },
    { headers }
  );
}
