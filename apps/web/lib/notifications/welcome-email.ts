import "server-only";
import { sendEmail } from "@/lib/notifications/email";
import { renderEmailTemplate, escapeHtml } from "@/lib/notifications/email-template";

/**
 * Sent once, right after a new user finishes onboarding (their first
 * workspace is created) — see app/api/orgs/route.ts. Fire-and-forget: a
 * failure here must never block workspace creation, so callers should
 * treat this as best-effort and not await-and-throw.
 */
export async function sendWelcomeEmail(to: string, opts: { orgName: string }): Promise<void> {
  const orgName = escapeHtml(opts.orgName);
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`;
  const html = renderEmailTemplate({
    previewText: `Welcome to VeloBot — ${orgName} is ready to go.`,
    heading: `Welcome to VeloBot, ${orgName}!`,
    paragraphs: [
      `Your workspace is ready. VeloBot helps teams answer customers instantly with AI trained on their own content, and hand off to a human the moment it matters.`,
      `Head to your dashboard to create your first bot, connect your content, and customize how it looks and responds.`,
    ],
    cta: { text: "Go to your dashboard", url: dashboardUrl },
    footnote: "If you weren't expecting this email, you can safely ignore it.",
  });
  await sendEmail(to, "Welcome to VeloBot", html);
}
