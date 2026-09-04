import "server-only";
import { sendEmail } from "@/lib/notifications/email";
import { renderEmailTemplate, escapeHtml } from "@/lib/notifications/email-template";

/**
 * Sent by app/api/internal/notify-plan-expiring/route.ts (called on a
 * schedule by supabase/functions/plan-expiry-watcher) a few days before a
 * paid plan's current_period_end. Since plan purchases are one-time
 * Orders, not auto-renewing Subscriptions, nothing charges the org again
 * automatically — this is the only warning they get before the org would
 * otherwise just sit on an expired-looking plan with no prompt to renew.
 */
export async function sendPlanExpiryEmail(
  to: string,
  opts: { orgName: string; planName: string; daysRemaining: number; expiresOn: Date }
): Promise<void> {
  const orgName = escapeHtml(opts.orgName);
  const planName = escapeHtml(opts.planName);
  const billingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing`;
  const dateLabel = opts.expiresOn.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const dayWord = opts.daysRemaining === 1 ? "day" : "days";

  const html = renderEmailTemplate({
    previewText: `Your ${planName} plan expires in ${opts.daysRemaining} ${dayWord}.`,
    heading: `Your plan expires in ${opts.daysRemaining} ${dayWord}`,
    paragraphs: [
      `<strong>${orgName}</strong>'s <strong>${planName}</strong> plan on VeloBot is set to expire on <strong>${dateLabel}</strong>.`,
      `VeloBot plans don't renew automatically — renew now to keep your bots, quotas, and team seats without interruption.`,
    ],
    cta: { text: "Renew your plan", url: billingUrl },
    footnote: "If you've already renewed, you can safely ignore this email.",
  });
  await sendEmail(to, `Your ${opts.planName} plan expires in ${opts.daysRemaining} ${dayWord}`, html);
}
