import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Used by every widget-facing route to refuse service for a Super-Admin-suspended org. */
export async function isOrgSuspended(orgId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("organizations").select("suspended_at").eq("id", orgId).maybeSingle();
  return !!data?.suspended_at;
}
