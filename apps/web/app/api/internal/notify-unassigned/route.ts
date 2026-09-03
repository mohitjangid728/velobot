import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifySlack } from "@/lib/notifications/slack";
import { notifyDiscord } from "@/lib/notifications/discord";
import { sendEmail } from "@/lib/notifications/email";
import { renderEmailTemplate, escapeHtml } from "@/lib/notifications/email-template";

export const runtime = "nodejs";

const NotifySchema = z.object({
  conversation_id: z.string().uuid(),
  bot_name: z.string(),
  org_id: z.string().uuid(),
  queue_id: z.string().uuid().nullable(),
  visitor_email: z.string().nullable(),
  waited_seconds: z.number(),
});

/**
 * Called by supabase/functions/escalation-watcher (never by the browser or
 * the widget) when a `queued` ticket has sat unassigned past the 60s
 * threshold. Kept as a Next.js route — rather than duplicating
 * Slack/Discord/Resend calls in Deno — so notification delivery has one
 * implementation.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_FUNCTIONS_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = NotifySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid payload" }, { status: 400 });

  const { conversation_id, bot_name, org_id, queue_id, visitor_email, waited_seconds } = parsed.data;
  const inboxUrl = `${process.env.NEXT_PUBLIC_APP_URL}/inbox`;
  const text = `:rotating_light: A ${bot_name} conversation${visitor_email ? ` from ${visitor_email}` : ""} has been waiting ${waited_seconds}s for an agent. ${inboxUrl}`;

  const admin = createSupabaseAdminClient();

  // Prefer the ticket's queue members; fall back to the org's earliest-added
  // admin (no single "owner" anymore) when the bot has no queue assigned
  // (or the queue has no members).
  let recipientUserIds: string[] = [];
  if (queue_id) {
    const { data: queueMembers } = await admin.from("queue_members").select("user_id").eq("queue_id", queue_id);
    recipientUserIds = (queueMembers ?? []).map((m) => m.user_id);
  }
  if (recipientUserIds.length === 0) {
    const { data: primaryAdmin } = await admin
      .from("org_members")
      .select("user_id")
      .eq("org_id", org_id)
      .eq("role", "admin")
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (primaryAdmin?.user_id) recipientUserIds = [primaryAdmin.user_id];
  }

  const tasks: Promise<unknown>[] = [notifySlack(text), notifyDiscord(text)];
  if (recipientUserIds.length > 0) {
    const emailHtml = renderEmailTemplate({
      previewText: `A ${bot_name} conversation has been waiting ${waited_seconds}s for an agent.`,
      heading: "A conversation needs an agent",
      paragraphs: [
        `A <strong>${escapeHtml(bot_name)}</strong> conversation${visitor_email ? ` from <strong>${escapeHtml(visitor_email)}</strong>` : ""} has been waiting <strong>${waited_seconds}s</strong> for an agent.`,
      ],
      cta: { text: "Open inbox", url: inboxUrl },
    });
    for (const userId of recipientUserIds) {
      const { data: userRes } = await admin.auth.admin.getUserById(userId);
      if (userRes.user?.email) {
        tasks.push(sendEmail(userRes.user.email, `Unassigned conversation waiting (${bot_name})`, emailHtml));
      }
    }
  }
  await Promise.allSettled(tasks);

  return Response.json({ ok: true, conversation_id });
}
