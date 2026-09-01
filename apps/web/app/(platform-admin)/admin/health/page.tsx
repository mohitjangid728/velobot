import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface FailedLogRow {
  id: string;
  org_id: string;
  source: string;
  request_method: string;
  request_path: string;
  response_status: number | null;
  error_message: string | null;
  created_at: string;
  connections: { name: string } | null;
  organizations: { id: string; name: string } | null;
}

export default async function AdminHealthPage() {
  await requirePlatformAdmin();
  const admin = createSupabaseAdminClient();

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: recent }, { count: failuresLast24h }, { count: failuresLast7d }] = await Promise.all([
    admin
      .from("connection_logs")
      .select("id, org_id, source, request_method, request_path, response_status, error_message, created_at, connections(name), organizations(id, name)")
      .or("error_message.not.is.null,response_status.gte.400")
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("connection_logs")
      .select("id", { count: "exact", head: true })
      .or("error_message.not.is.null,response_status.gte.400")
      .gte("created_at", dayAgo),
    admin
      .from("connection_logs")
      .select("id", { count: "exact", head: true })
      .or("error_message.not.is.null,response_status.gte.400")
      .gte("created_at", weekAgo),
  ]);

  const rows = (recent ?? []) as unknown as FailedLogRow[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">System health</h1>
        <p className="text-sm text-muted-foreground">Failed connection/action calls across every workspace — not business metrics, platform ones.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="flex flex-col gap-1 p-4">
          <span className="text-xs font-medium text-muted-foreground">Failures, last 24h</span>
          <span className="text-2xl font-bold tabular-nums">{failuresLast24h ?? 0}</span>
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <span className="text-xs font-medium text-muted-foreground">Failures, last 7 days</span>
          <span className="text-2xl font-bold tabular-nums">{failuresLast7d ?? 0}</span>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent failures</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y p-0">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-col gap-1 px-6 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Link href={`/admin/orgs/${r.org_id}`} className="font-medium text-primary hover:underline">
                    {r.organizations?.name ?? "Unknown org"}
                  </Link>
                  <span className="text-muted-foreground">· {r.connections?.name ?? "connection"}</span>
                  <Badge variant="outline" className="uppercase">
                    {r.source}
                  </Badge>
                </span>
                <span className="flex items-center gap-2">
                  {r.response_status && <Badge variant="serious">{r.response_status}</Badge>}
                  <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                </span>
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {r.request_method} {r.request_path}
              </span>
              {r.error_message && <span className="text-xs text-status-critical">{r.error_message}</span>}
            </div>
          ))}
          {rows.length === 0 && <p className="px-6 py-4 text-sm text-muted-foreground">No failures logged. Everything&apos;s healthy.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
