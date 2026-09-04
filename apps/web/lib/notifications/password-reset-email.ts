import "server-only";
import { sendEmail } from "@/lib/notifications/email";
import { renderEmailTemplate } from "@/lib/notifications/email-template";

/**
 * Sent from app/api/auth/forgot-password/route.ts, which generates the
 * Supabase auth link itself (via generateLink) rather than letting
 * Supabase's own built-in mailer send it — same reasoning as invites and
 * the (removed) signup confirmation: one branded Resend template instead
 * of a mix of our design and Supabase's default.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const html = renderEmailTemplate({
    previewText: "Reset your VeloBot password.",
    heading: "Reset your password",
    paragraphs: [
      "We got a request to reset the password on your VeloBot account.",
      "If you didn't ask for this, you can safely ignore this email — your password won't change.",
    ],
    cta: { text: "Reset password", url: resetUrl },
    footnote: "This link expires in 1 hour.",
  });
  await sendEmail(to, "Reset your VeloBot password", html);
}
