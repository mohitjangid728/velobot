import { requireRole } from "@/lib/auth/session";
import { listConnections, maskConnectionHeaders } from "@/lib/connections/connections-manager";
import { ConnectionsTab } from "@/components/dashboard/connections-tab";

export default async function ConnectionsPage() {
  const { org } = await requireRole("admin");
  const connections = (await listConnections(org.id)).map(maskConnectionHeaders);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Connections</h1>
        <p className="text-sm text-muted-foreground">
          Reusable API endpoints and credentials, shared across every bot in your workspace — link one to a Bot
          Action to let your bots and agents call it.
        </p>
      </div>
      <ConnectionsTab orgId={org.id} initialConnections={connections} />
    </div>
  );
}
