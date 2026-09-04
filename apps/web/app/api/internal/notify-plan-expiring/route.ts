import { PLANS, type PlanTier } from "@velobot/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendPlanExpiryEmail } from "@/lib/notifications/plan-expiry-email";

export const runtime = "nodejs";

const REMINDER_WINDOW_DAYS = 3;

/**
 * Called on a schedule by supabase/functions/plan-expiry-watcher (never by
 * the browser or the widget) — same shape as notify-unassigned. Finds
 * paid orgs whose current_period_end falls within REMINDER_WINDOW_DAYS
 * and haven't already been reminded for this period, emails their
 * earliest-added admin, and stamps expiry_reminder_sent_at so the next
 * run (this route is meant to run daily) doesn't re-send until the org
 * renews into a new period.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_FUNCTIONS_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const { data: candidates, error } = await admin
    .from("organizations")
    .select("id, name, plan, current_period_start, current_period_end, expiry_reminder_sent_at")
    .neq("plan", "free")
    .not("current_period_end", "is", null)
    .gt("current_period_end", now.toISOString())
    .lte("current_period_end", windowEnd.toISOString());

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const dueOrgs = (candidates ?? []).filter((org) => {
    if (!org.expiry_reminder_sent_at) return true;
    // A reminder already sent before the current period started is stale
    // (leftover from a prior period) — this one hasn't been reminded yet.
    return !org.current_period_start || org.expiry_reminder_sent_at < org.current_period_start;
  });

  let sent = 0;
  for (const org of dueOrgs) {
    const { data: primaryAdmin } = await admin
      .from("org_members")
      .select("user_id")
      .eq("org_id", org.id)
      .eq("role", "admin")
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!primaryAdmin?.user_id) continue;

    const { data: userRes } = await admin.auth.admin.getUserById(primaryAdmin.user_id);
    if (!userRes.user?.email) continue;

    const expiresOn = new Date(org.current_period_end!);
    const daysRemaining = Math.max(1, Math.ceil((expiresOn.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

    await sendPlanExpiryEmail(userRes.user.email, {
      orgName: org.name,
      planName: PLANS[org.plan as PlanTier]?.name ?? org.plan,
      daysRemaining,
      expiresOn,
    });
    await admin.from("organizations").update({ expiry_reminder_sent_at: now.toISOString() }).eq("id", org.id);
    sent++;
  }

  return Response.json({ ok: true, checked: candidates?.length ?? 0, sent });
}
