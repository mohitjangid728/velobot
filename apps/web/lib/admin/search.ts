import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface SearchOrgResult {
  id: string;
  name: string;
  slug: string;
}
export interface SearchBotResult {
  id: string;
  name: string;
  org_id: string;
  organizations: { id: string; name: string } | null;
}
export interface SearchMemberResult {
  id: string;
  org_id: string;
  invited_email: string | null;
  organizations: { id: string; name: string } | null;
}
export interface SearchResults {
  orgs: SearchOrgResult[];
  bots: SearchBotResult[];
  members: SearchMemberResult[];
}

/**
 * Only matches pending-invite emails on the member side — accepted
 * members' emails live in auth.users, which isn't indexed for search here.
 * Org name/slug and bot name are matched directly.
 */
export async function searchPlatform(q: string): Promise<SearchResults> {
  const trimmed = q.trim();
  if (trimmed.length < 2) return { orgs: [], bots: [], members: [] };

  const admin = createSupabaseAdminClient();
  const like = `%${trimmed}%`;

  const [{ data: orgs }, { data: bots }, { data: members }] = await Promise.all([
    admin.from("organizations").select("id, name, slug").or(`name.ilike.${like},slug.ilike.${like}`).limit(10),
    admin.from("bots").select("id, name, org_id, organizations(id, name)").ilike("name", like).limit(10),
    admin
      .from("org_members")
      .select("id, org_id, invited_email, organizations(id, name)")
      .ilike("invited_email", like)
      .limit(10),
  ]);

  return {
    orgs: (orgs ?? []) as SearchOrgResult[],
    bots: (bots ?? []) as unknown as SearchBotResult[],
    members: (members ?? []) as unknown as SearchMemberResult[],
  };
}
