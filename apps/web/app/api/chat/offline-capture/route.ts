import type { NextRequest } from "next/server";
import { OfflineEmailCaptureSchema } from "@velobot/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isOriginAllowed, corsHeaders } from "@/lib/security/origin";
import { getOrCreateConversation, clientIp } from "@/lib/conversations";
import { sendEmail } from "@/lib/notifications/email";
import { isOrgSuspended } from "@/lib/organizations";

export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  // No body on a preflight request — can't look up the bot yet, so this
  // stays permissive. See the corsHeaders() doc comment.
  return new Response(null, { status: 204, headers: corsHeaders(req, true) });
}

/**
 * Used when the widget's widget-config fetch reports no agents online: the
 * visitor leaves their email + question instead of waiting in a queue no
 * one will pick up (Module 4's "Offline Fallback" requirement).
 */
export async function POST(req: NextRequest) {
  const parsed = OfflineEmailCaptureSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400, headers: corsHeaders(req, true) });

  const admin = createSupabaseAdminClient();
  const { data: bot } = await admin.from("bots").select("*").eq("id", parsed.data.bot_id).maybeSingle();
  if (!bot) return Response.json({ error: "Bot not found" }, { status: 404, headers: corsHeaders(req, true) });

  const allowed = isOriginAllowed(bot, req);
  const headers = corsHeaders(req, allowed);
  if (!allowed) return Response.json({ error: "Origin not allowed" }, { status: 403, headers });
  if (await isOrgSuspended(bot.org_id)) return Response.json({ error: "This bot is currently unavailable." }, { status: 403, headers });

  const conversation = await getOrCreateConversation(bot, parsed.data.session_id, { ip: clientIp(req) });

  await admin
    .from("conversations")
    .update({
      visitor_email: parsed.data.visitor_email,
      status: "queued",
      queued_at: new Date().toISOString(),
      queue_id: bot.queue_id,
    })
    .eq("id", conversation.id);

  await admin.from("messages").insert({
    conversation_id: conversation.id,
    role: "user",
    content: parsed.data.message,
  });
  await admin.from("messages").insert({
    conversation_id: conversation.id,
    role: "system",
    content: `Visitor left their email (${parsed.data.visitor_email}) for async follow-up — no agents were online.`,
  });

  // No single "owner" anymore — the earliest-added admin stands in as the
  // org's primary contact for this notification.
  const { data: primaryAdmin } = await admin
    .from("org_members")
    .select("user_id")
    .eq("org_id", bot.org_id)
    .eq("role", "admin")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (primaryAdmin?.user_id) {
    const { data: userRes } = await admin.auth.admin.getUserById(primaryAdmin.user_id);
    if (userRes.user?.email) {
      await sendEmail(
        userRes.user.email,
        `New offline message for ${bot.name}`,
        `<p>A visitor left a message while no agents were online:</p><blockquote>${parsed.data.message}</blockquote><p>Reply to: ${parsed.data.visitor_email}</p>`
      );
    }
  }

  return Response.json({ ok: true, conversationId: conversation.id }, { headers });
}
