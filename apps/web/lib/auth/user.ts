import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Leaf module with no internal deps — both session.ts (org-scoped auth) and
 * platform-admin.ts (cross-org auth) need "get the current user" without
 * depending on each other, so it lives here rather than in either.
 */
export async function getCurrentUser() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
