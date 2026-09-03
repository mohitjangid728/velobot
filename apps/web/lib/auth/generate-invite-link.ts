import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * `generateLink({type:"invite"})` only works for an email with no existing
 * Supabase Auth user — for one that's already registered (e.g. an existing
 * VeloBot user being invited into a second org) it fails with the
 * `email_exists` API error instead of returning a link. `magiclink` works
 * for an existing user in exactly the same way `invite` works for a new
 * one (creates no new user, just returns a verification link), so on that
 * specific error we retry with `magiclink` rather than surfacing a failure
 * for what's actually a completely normal invite scenario.
 */
export async function generateInviteLink(
  admin: SupabaseClient,
  email: string,
  redirectTo: string
): Promise<{ actionLink: string | null; error: string | null }> {
  const first = await admin.auth.admin.generateLink({ type: "invite", email, options: { redirectTo } });
  if (first.error?.code === "email_exists") {
    const retry = await admin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } });
    return { actionLink: retry.data?.properties?.action_link ?? null, error: retry.error?.message ?? null };
  }
  return { actionLink: first.data?.properties?.action_link ?? null, error: first.error?.message ?? null };
}
