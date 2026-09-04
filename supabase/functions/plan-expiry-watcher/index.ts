// Supabase Edge Function (Deno). Intended to be invoked on a schedule —
// e.g. via pg_cron + pg_net once a day — see the cron.schedule() snippet
// at the bottom of supabase/sql/013_plan_expiry_reminder.sql.
//
// Unlike escalation-watcher, all the querying/dedup/sending logic already
// lives in the Next.js route (app/api/internal/notify-plan-expiring) since
// there's no per-conversation Realtime state to update here — this
// function is just the scheduled trigger.
//
// deno-lint-ignore-file no-explicit-any
Deno.serve(async () => {
  const appUrl = Deno.env.get("APP_URL")!; // e.g. https://velobot.techfen.com
  const internalSecret = Deno.env.get("INTERNAL_FUNCTIONS_SECRET")!;

  const res = await fetch(`${appUrl}/api/internal/notify-plan-expiring`, {
    method: "POST",
    headers: { "x-internal-secret": internalSecret },
  });
  const body = await res.json().catch(() => ({}));

  return new Response(JSON.stringify(body), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
});
