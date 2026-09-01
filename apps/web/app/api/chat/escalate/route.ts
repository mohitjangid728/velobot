import type { NextRequest } from "next/server";
import { EscalateSchema } from "@velobot/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isOriginAllowed, corsHeaders } from "@/lib/security/origin";
import { anyAgentsOnline } from "@/lib/presence";
import { getOrCreateConversation, clientIp } from "@/lib/conversations";
import { isOrgSuspended } from "@/lib/organizations";

export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  // No body on a preflight request — can't look up the bot yet, so this
  // stays permissive. See the corsHeaders() doc comment.
  return new Response(null, { status: 204, headers: corsHeaders(req, true) });
}

export async function POST(req: NextRequest) {
  const parsed = EscalateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400, headers: corsHeaders(req, true) });

  const admin = createSupabaseAdminClient();
  const { data: bot } = await admin.from("bots").select("*").eq("id", parsed.data.bot_id).maybeSingle();
  if (!bot) return Response.json({ error: "Bot not found" }, { status: 404, headers: corsHeaders(req, true) });

  const allowed = isOriginAllowed(bot, req);
  const headers = corsHeaders(req, allowed);
  if (!allowed) return Response.json({ error: "Origin not allowed" }, { status: 403, headers });
  if (await isOrgSuspended(bot.org_id)) return Response.json({ error: "This bot is currently unavailable." }, { status: 403, headers });

  const conversation = await getOrCreateConversation(bot, parsed.data.session_id, {
    url: parsed.data.page_url,
    ip: clientIp(req),
  });

  const online = await anyAgentsOnline(bot.org_id);

  if (conversation.status === "ai" || conversation.status === "resolved") {
    await admin
      .from("conversations")
      .update({
        status: "queued",
        queued_at: new Date().toISOString(),
        visitor_email: parsed.data.visitor_email ?? conversation.visitor_email,
        unread_by_agent: true,
        // Copied from the bot's current queue assignment, not looked up
        // live later — reassigning the bot's queue afterwards shouldn't
        // retroactively move an in-flight ticket.
        queue_id: bot.queue_id,
      })
      .eq("id", conversation.id);

    await admin.from("messages").insert({
      conversation_id: conversation.id,
      role: "system",
      content: "Visitor requested a human agent.",
    });
  }

  return Response.json({ status: "queued", agentsOnline: online, conversationId: conversation.id }, { headers });
}
