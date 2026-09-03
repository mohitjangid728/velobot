import "server-only";
import { sendEmail } from "@/lib/notifications/email";
import { renderEmailTemplate, escapeHtml } from "@/lib/notifications/email-template";

/**
 * The only invite email VeloBot sends — see api/orgs/[orgId]/invites/route.ts,
 * which now generates the Supabase auth link itself (via generateLink)
 * rather than letting Supabase's own built-in mailer send it, specifically
 * so every invite (new signup or existing account) goes out through this
 * one branded template instead of a mix of our design and Supabase's
 * default. `acceptUrl` is that Supabase-hosted verification link — clicking
 * it establishes the session, then redirects into our own /accept-invite
 * flow, so this function itself has no auth logic of its own.
 */
export async function sendInviteEmail(
  to: string,
  acceptUrl: string,
  opts: { orgName: string; role: "admin" | "agent" }
): Promise<void> {
  const roleLabel = opts.role === "admin" ? "an Admin" : "an Agent";
  const orgName = escapeHtml(opts.orgName);
  const html = renderEmailTemplate({
    previewText: `You've been invited to join ${orgName} on VeloBot.`,
    heading: `You've been invited to join ${orgName}`,
    paragraphs: [
      `You've been invited to join <strong>${orgName}</strong> on VeloBot as ${roleLabel}.`,
      `VeloBot helps teams answer customers instantly with AI trained on their own content, and hand off to a human the moment it matters.`,
    ],
    cta: { text: "Accept invitation", url: acceptUrl },
    footnote: "This invite link expires in 7 days. If you weren't expecting this, you can safely ignore this email.",
  });
  await sendEmail(to, `You've been invited to join ${opts.orgName} on VeloBot`, html);
}
