import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ROLE_RANK, type Role, type OrgMember, type Organization } from "@velobot/shared";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";

export { getCurrentUser, requireUser } from "@/lib/auth/user";
import { requireUser } from "@/lib/auth/user";

export const ACTIVE_ORG_COOKIE = "velobot-org-id";
/** Set to an org id while a Super Admin is impersonating that org. Re-verified against isPlatformAdmin on every read — never trusted on its own. */
export const IMPERSONATION_COOKIE = "velobot-impersonate-org-id";

/** All orgs the current user belongs to, with their role in each. */
export async function listMemberships(userId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("org_members")
    .select("*, organizations(*)")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) throw error;
  return (data ?? []) as (OrgMember & { organizations: Organization })[];
}

/** Resolves the "active" org from a cookie, falling back to the user's first membership. */
export async function getActiveOrg() {
  const user = await requireUser();

  const impersonateOrgId = cookies().get(IMPERSONATION_COOKIE)?.value;
  if (impersonateOrgId && (await isPlatformAdmin(user.id))) {
    // Super Admin impersonation: synthesize a virtual "admin" membership
    // (the top org role) for this org rather than requiring a real
    // org_members row. RLS reads still work because is_org_member() also
    // grants platform admins blanket access (see
    // supabase/sql/002_platform_admin_and_queues.sql).
    const admin = createSupabaseAdminClient();
    const { data: org } = await admin.from("organizations").select("*").eq("id", impersonateOrgId).maybeSingle();
    if (org) {
      const memberships = await listMemberships(user.id);
      return { user, memberships, org: org as Organization, role: "admin" as Role, impersonating: true };
    }
  }

  const memberships = await listMemberships(user.id);
  if (memberships.length === 0) return { user, memberships, org: null, role: null, impersonating: false };

  const cookieOrgId = cookies().get(ACTIVE_ORG_COOKIE)?.value;
  // Non-null: the length===0 case already returned above.
  const active = memberships.find((m) => m.org_id === cookieOrgId) ?? memberships[0]!;

  return {
    user,
    memberships,
    org: active.organizations,
    role: active.role as Role,
    impersonating: false,
  };
}

/** Redirects to /onboarding if the user has no active org+role, otherwise returns both. */
export async function requireActiveOrg() {
  const ctx = await getActiveOrg();
  if (!ctx.org || !ctx.role) {
    // A Super Admin isn't expected to belong to any workspace — send them
    // to the admin panel instead of the "create your first workspace" flow.
    if (ctx.memberships.length === 0 && (await isPlatformAdmin(ctx.user.id))) {
      redirect("/admin");
    }
    redirect("/onboarding");
  }
  // Super Admins only ever use dashboard routes via impersonation (see
  // getActiveOrg above) — a real membership of their own isn't a supported
  // path, so route them to the admin panel instead of leaking normal org
  // access onto the platform-admin account.
  if (!ctx.impersonating && (await isPlatformAdmin(ctx.user.id))) {
    redirect("/admin");
  }
  if (ctx.org.suspended_at) redirect("/suspended");
  return ctx as {
    user: NonNullable<typeof ctx.user>;
    memberships: typeof ctx.memberships;
    org: NonNullable<typeof ctx.org>;
    role: Role;
    impersonating: boolean;
  };
}

/** Redirects away if the current user's role in the active org is below `minRole`. */
export async function requireRole(minRole: Role) {
  const ctx = await requireActiveOrg();
  if (ROLE_RANK[ctx.role] < ROLE_RANK[minRole]) {
    redirect("/dashboard?error=insufficient_permissions");
  }
  return ctx;
}

/**
 * Non-redirecting variant for use inside Route Handlers, which return JSON
 * instead. Also the single choke point every API-side guard
 * (requireBotAccess, requireConversationAccess) goes through, so the
 * impersonation check here alone is enough to make those work for a
 * Super Admin without touching either guard's own code.
 */
export async function getRoleForOrg(userId: string, orgId: string): Promise<Role | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("org_members")
    .select("role")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("status", "active")
    .maybeSingle();
  if (data?.role) return data.role as Role;

  const impersonateOrgId = cookies().get(IMPERSONATION_COOKIE)?.value;
  if (impersonateOrgId === orgId && (await isPlatformAdmin(userId))) {
    return "admin";
  }
  return null;
}
