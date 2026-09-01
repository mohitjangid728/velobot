import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser, requireUser } from "@/lib/auth/user";
import type { PlatformAdminRole } from "@velobot/shared";

/** RLS-scoped (self-row policy) check — see supabase/sql/002_platform_admin_and_queues.sql. Null if not a Super Admin at all. */
export async function getPlatformAdminRole(userId: string): Promise<PlatformAdminRole | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("platform_admins").select("role").eq("user_id", userId).maybeSingle();
  return (data?.role as PlatformAdminRole | undefined) ?? null;
}

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  return (await getPlatformAdminRole(userId)) !== null;
}

/** Redirects to /dashboard if the current user isn't a Super Admin. Attaches their role (any) for pages to gate mutating UI on. */
export async function requirePlatformAdmin() {
  const user = await requireUser();
  const role = await getPlatformAdminRole(user.id);
  if (!role) redirect("/dashboard");
  return { ...user, platformAdminRole: role };
}

/** Redirects to /admin if the current user isn't a "full" Super Admin — for pages that only make sense with mutate access. */
export async function requireFullPlatformAdmin() {
  const admin = await requirePlatformAdmin();
  if (admin.platformAdminRole !== "full") redirect("/admin");
  return admin;
}

/** Non-redirecting variant for Route Handlers — any Super Admin role. */
export async function requirePlatformAdminApi() {
  const user = await getCurrentUser();
  if (!user) return null;
  const role = await getPlatformAdminRole(user.id);
  if (!role) return null;
  return { ...user, platformAdminRole: role };
}

/** Non-redirecting variant for Route Handlers that mutate state — "full" role only. A "support" admin gets the same 403 a non-admin would. */
export async function requireFullPlatformAdminApi() {
  const admin = await requirePlatformAdminApi();
  if (!admin || admin.platformAdminRole !== "full") return null;
  return admin;
}
