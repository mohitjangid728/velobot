import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listConnections, maskConnectionHeaders } from "@/lib/connections/connections-manager";
import { listActions } from "@/lib/actions/actions-manager";
import { ActionsTab } from "@/components/dashboard/actions-tab";

export default async function ActionsPage() {
  const { org } = await requireRole("admin");
  const supabase = createSupabaseServerClient();

  const [connections, actions, { data: bots }] = await Promise.all([
    listConnections(org.id).then((conns) => conns.map(maskConnectionHeaders)),
    listActions(org.id),
    supabase.from("bots").select("id, name").eq("org_id", org.id).order("name", { ascending: true }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Actions</h1>
        <p className="text-sm text-muted-foreground">
          Reusable capabilities — capture leads, look up orders, book appointments — that any bot in your workspace
          can offer to the AI and your agents.
        </p>
      </div>
      <ActionsTab orgId={org.id} connections={connections} bots={bots ?? []} initialActions={actions} />
    </div>
  );
}
