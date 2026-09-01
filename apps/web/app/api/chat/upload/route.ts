import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isOriginAllowed, corsHeaders } from "@/lib/security/origin";
import { isOrgSuspended } from "@/lib/organizations";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"]);
const BUCKET = "conversation-attachments";

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req, true) });
}

/**
 * File/screenshot attachments from the widget. Multipart rather than JSON
 * (the one such route in the chat-facing API) since the payload is binary.
 * The bucket itself is a manual Supabase dashboard step — see the note at
 * the bottom of supabase/sql/009_launch_readiness.sql — not something a SQL
 * migration creates.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const botId = form?.get("bot_id");
  const sessionId = form?.get("session_id");
  const file = form?.get("file");
  if (typeof botId !== "string" || typeof sessionId !== "string" || !(file instanceof File)) {
    return Response.json({ error: "Invalid request" }, { status: 400, headers: corsHeaders(req, true) });
  }

  const admin = createSupabaseAdminClient();
  const { data: bot } = await admin.from("bots").select("*").eq("id", botId).maybeSingle();
  if (!bot) return Response.json({ error: "Bot not found" }, { status: 404, headers: corsHeaders(req, true) });

  const allowed = isOriginAllowed(bot, req);
  const headers = corsHeaders(req, allowed);
  if (!allowed) return Response.json({ error: "Origin not allowed" }, { status: 403, headers });
  if (await isOrgSuspended(bot.org_id)) return Response.json({ error: "This bot is currently unavailable." }, { status: 403, headers });

  if (!ALLOWED_TYPES.has(file.type)) {
    return Response.json({ error: "Unsupported file type. Images and PDFs only." }, { status: 400, headers });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "File too large — 5MB max." }, { status: 400, headers });
  }

  const ext = file.name.split(".").pop()?.slice(0, 10) ?? "bin";
  const path = `${bot.org_id}/${sessionId}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, file, { contentType: file.type });
  if (uploadError) return Response.json({ error: "Upload failed" }, { status: 500, headers });

  const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(path);

  return Response.json({ url: publicUrl.publicUrl, type: file.type }, { headers });
}
