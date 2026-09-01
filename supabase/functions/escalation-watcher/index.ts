// Supabase Edge Function (Deno). Intended to be invoked on a schedule —
// e.g. via pg_cron + pg_net every 30s:
//
//   select cron.schedule(
//     'escalation-watcher',
//     '30 seconds',
//     $$ select net.http_post(
//          url := '<project-url>/functions/v1/escalation-watcher',
//          headers := jsonb_build_object('Authorization', 'Bearer <service_role_key>')
//        ) $$
//   );
//
// Finds `queued` conversations that have sat unassigned past
// ESCALATION_ALERT_THRESHOLD_SECONDS (60s) and haven't been alerted yet,
// notifies the org via the Next.js internal route (which owns the actual
// Slack/Discord/Resend delivery logic), then stamps alerted_at so the next
// run doesn't re-notify for the same ticket.
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ESCALATION_ALERT_THRESHOLD_SECONDS = 60;

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const appUrl = Deno.env.get("APP_URL")!; // e.g. https://app.velobot.example
  const internalSecret = Deno.env.get("INTERNAL_FUNCTIONS_SECRET")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const cutoff = new Date(Date.now() - ESCALATION_ALERT_THRESHOLD_SECONDS * 1000).toISOString();

  const { data: stale, error } = await supabase
    .from("conversations")
    .select("id, org_id, bot_id, queue_id, visitor_email, queued_at, bots(name)")
    .eq("status", "queued")
    .is("alerted_at", null)
    .lte("queued_at", cutoff)
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const results = [];
  for (const conversation of stale ?? []) {
    const waitedSeconds = Math.round((Date.now() - new Date(conversation.queued_at as string).getTime()) / 1000);
    const botName = (conversation as any).bots?.name ?? "your bot";

    const res = await fetch(`${appUrl}/api/internal/notify-unassigned`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": internalSecret },
      body: JSON.stringify({
        conversation_id: conversation.id,
        bot_name: botName,
        org_id: conversation.org_id,
        queue_id: conversation.queue_id,
        visitor_email: conversation.visitor_email,
        waited_seconds: waitedSeconds,
      }),
    });

    if (res.ok) {
      await supabase.from("conversations").update({ alerted_at: new Date().toISOString() }).eq("id", conversation.id);
    }
    results.push({ conversation_id: conversation.id, notified: res.ok });
  }

  return new Response(JSON.stringify({ checked: stale?.length ?? 0, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
