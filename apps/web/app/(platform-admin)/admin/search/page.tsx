import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { searchPlatform } from "@/lib/admin/search";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminSearchPage({ searchParams }: { searchParams: { q?: string } }) {
  await requirePlatformAdmin();
  const q = searchParams.q ?? "";
  const results = q.trim().length >= 2 ? await searchPlatform(q) : { orgs: [], bots: [], members: [] };
  const hasAny = results.orgs.length + results.bots.length + results.members.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Search</h1>
        <p className="text-sm text-muted-foreground">
          {q ? (
            <>
              Results for <span className="font-medium text-foreground">&ldquo;{q}&rdquo;</span>
            </>
          ) : (
            "Search organizations, bots, and pending invites."
          )}
        </p>
      </div>

      {q.trim().length < 2 ? (
        <p className="text-sm text-muted-foreground">Type at least 2 characters to search.</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Organizations</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y p-0">
              {results.orgs.map((o) => (
                <Link key={o.id} href={`/admin/orgs/${o.id}`} className="flex items-center justify-between px-6 py-2 text-sm hover:bg-muted/40">
                  <span className="font-medium text-primary">{o.name}</span>
                  <span className="text-muted-foreground">{o.slug}</span>
                </Link>
              ))}
              {results.orgs.length === 0 && <p className="px-6 py-4 text-sm text-muted-foreground">No matching organizations.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bots</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y p-0">
              {results.bots.map((b) => (
                <Link
                  key={b.id}
                  href={`/admin/orgs/${b.org_id}/bots/${b.id}`}
                  className="flex items-center justify-between px-6 py-2 text-sm hover:bg-muted/40"
                >
                  <span className="font-medium text-primary">{b.name}</span>
                  <span className="text-muted-foreground">{b.organizations?.name ?? "—"}</span>
                </Link>
              ))}
              {results.bots.length === 0 && <p className="px-6 py-4 text-sm text-muted-foreground">No matching bots.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pending invites</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y p-0">
              {results.members.map((m) => (
                <Link
                  key={m.id}
                  href={`/admin/orgs/${m.org_id}`}
                  className="flex items-center justify-between px-6 py-2 text-sm hover:bg-muted/40"
                >
                  <span className="font-medium text-primary">{m.invited_email}</span>
                  <span className="text-muted-foreground">{m.organizations?.name ?? "—"}</span>
                </Link>
              ))}
              {results.members.length === 0 && (
                <p className="px-6 py-4 text-sm text-muted-foreground">
                  No matching pending invites. (Accepted members can only be found by opening their organization.)
                </p>
              )}
            </CardContent>
          </Card>

          {!hasAny && (
            <p className="text-sm text-muted-foreground">Nothing matched &ldquo;{q}&rdquo; anywhere on the platform.</p>
          )}
        </>
      )}
    </div>
  );
}
