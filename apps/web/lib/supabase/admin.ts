import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses RLS entirely. Server-only, and
 * only for code paths that have already authorized the caller themselves
 * (ingestion workers, webhooks, the escalation watcher's internal route).
 * NEVER import this from a Client Component or expose it via an API
 * response.
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
