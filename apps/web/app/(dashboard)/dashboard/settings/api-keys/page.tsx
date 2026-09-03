import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ApiKeysPanel } from "@/components/dashboard/api-keys-panel";
import { getEffectivePlan } from "@velobot/shared";
import { getPlanOverride } from "@/lib/billing/plan-overrides";

export default async function ApiKeysPage() {
  const { org } = await requireRole("admin");
  const supabase = createSupabaseServerClient();
  const [{ data: keys }, overrides] = await Promise.all([
    supabase
      .from("api_keys")
      .select("id, name, key_prefix, last_used_at, revoked_at, created_at")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false }),
    getPlanOverride(org.plan),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Developer API</h1>
        <p className="text-sm text-muted-foreground">Read your bots and conversations from your own systems.</p>
      </div>
      <ApiKeysPanel orgId={org.id} initialKeys={keys ?? []} hasApiAccess={getEffectivePlan(org.plan, overrides).capabilities.apiAccess} />
    </div>
  );
}
