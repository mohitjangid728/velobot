import "server-only";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** True if `target` is currently an admin and demoting/removing them would leave the org with zero admins. Lives outside the route file (not just co-located) because Next.js's route-type validation rejects any named export from a Route Handler file beyond HTTP methods/config — this broke `next build` when it was exported directly from route.ts. */
export async function wouldRemoveLastAdmin(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  orgId: string,
  targetRole: string
): Promise<boolean> {
  if (targetRole !== "admin") return false;
  const { count } = await admin
    .from("org_members")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("role", "admin")
    .eq("status", "active");
  return (count ?? 0) <= 1;
}
