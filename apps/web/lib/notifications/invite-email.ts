import "server-only";
import { sendEmail } from "@/lib/notifications/email";

/**
 * Supabase's inviteUserByEmail() is a "new user" mailer — it errors when the
 * address already belongs to a registered auth user, which is a completely
 * normal case (inviting a teammate who already has a VeloBot account in
 * another org). Message wording has shifted across supabase-js versions, so
 * this matches loosely rather than on one exact string/code.
 */
export function isAlreadyRegisteredError(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes("already been registered") || m.includes("already registered") || m.includes("already exists");
}

/**
 * The one path (see api/orgs/[orgId]/invites/route.ts) where we send our own
 * branded email instead of Supabase Auth's built-in inviteUserByEmail() —
 * used only when the invitee already has a VeloBot account, since Supabase's
 * mailer refuses to send to an existing user. Kept in its own module (rather
 * than inlined at the one call site) so the resend route can reuse it
 * without duplicating the HTML.
 */
export async function sendInviteEmail(to: string, acceptUrl: string, opts: { existingUser: boolean }): Promise<void> {
  const subject = opts.existingUser ? "You've been invited to a VeloBot workspace" : "You're invited to VeloBot";
  const html = `
    <p>${opts.existingUser ? "You've been invited to join a workspace on VeloBot." : "You've been invited to VeloBot."}</p>
    <p>You already have a VeloBot account, so just log in to accept:</p>
    <p><a href="${acceptUrl}">${acceptUrl}</a></p>
    <p>This link expires in 7 days.</p>
  `;
  await sendEmail(to, subject, html);
}
