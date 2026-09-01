import type { NextRequest } from "next/server";
import { SubmitRatingSchema } from "@velobot/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isOriginAllowed, corsHeaders } from "@/lib/security/origin";
import { isOrgSuspended } from "@/lib/organizations";

export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req, true) });
}

/** Post-resolve CSAT rating from the widget — see apps/widget/src/ui/widget.ts's csatForm. At most one rating is meaningful per conversation, but this doesn't enforce uniqueness server-side; the widget's own ratingSubmitted session flag is what prevents re-prompting. */
export async function POST(req: NextRequest) {
  const parsed = SubmitRatingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400, headers: corsHeaders(req, true) });

  const admin = createSupabaseAdminClient();
  const { data: bot } = await admin.from("bots").select("*").eq("id", parsed.data.bot_id).maybeSingle();
  if (!bot) return Response.json({ error: "Bot not found" }, { status: 404, headers: corsHeaders(req, true) });

  const allowed = isOriginAllowed(bot, req);
  const headers = corsHeaders(req, allowed);
  if (!allowed) return Response.json({ error: "Origin not allowed" }, { status: 403, headers });
  if (await isOrgSuspended(bot.org_id)) return Response.json({ error: "This bot is currently unavailable." }, { status: 403, headers });

  const { data: conversation } = await admin
    .from("conversations")
    .select("id, org_id")
    .eq("bot_id", bot.id)
    .eq("session_id", parsed.data.session_id)
    .maybeSingle();
  if (!conversation) return Response.json({ error: "Conversation not found" }, { status: 404, headers });

  await admin.from("conversation_ratings").insert({
    conversation_id: conversation.id,
    org_id: conversation.org_id,
    score: parsed.data.score,
    comment: parsed.data.comment ?? null,
  });

  return Response.json({ ok: true }, { headers });
}
