import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminAuditAction } from "@velobot/shared";
import type { AdminAuditLogWithActor } from "@/lib/admin/audit-log";

const ACTION_LABEL: Record<AdminAuditAction, string> = {
  "org.create": "created the workspace",
  "org.rename": "renamed the workspace",
  "org.delete": "deleted the workspace",
  "org.update_plan": "changed plan",
  "org.update_seats_limit": "changed seats limit",
  "org.update_addons": "adjusted add-ons",
  "org.suspend": "suspended workspace",
  "org.reactivate": "reactivated workspace",
  "org.impersonate": "impersonated workspace",
  "org.note_add": "left a note",
  "admin.promote": "promoted a Super Admin",
  "admin.demote": "removed a Super Admin",
};

function describeDetails(entry: AdminAuditLogWithActor): string | null {
  const d = entry.details;
  switch (entry.action) {
    case "org.create":
    case "org.delete":
      return typeof d.name === "string" ? d.name : null;
    case "org.rename": {
      const name = d.name as { from?: string; to?: string } | undefined;
      return name?.from && name?.to && name.from !== name.to ? `${name.from} → ${name.to}` : null;
    }
    case "org.update_plan":
      return typeof d.from === "string" && typeof d.to === "string" ? `${d.from} → ${d.to}` : null;
    case "org.update_seats_limit":
      return d.from !== undefined && d.to !== undefined ? `${d.from} → ${d.to}` : null;
    case "admin.promote":
    case "admin.demote":
      return typeof d.email === "string" ? d.email : null;
    default:
      return null;
  }
}

export function OrgAuditLog({
  entries,
  showOrgName = false,
  orgNameById = {},
}: {
  entries: AdminAuditLogWithActor[];
  showOrgName?: boolean;
  orgNameById?: Record<string, string>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" /> Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col divide-y p-0">
        {entries.map((entry) => {
          const detail = describeDetails(entry);
          return (
            <div key={entry.id} className="flex flex-col gap-0.5 px-6 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                <span>
                  <span className="font-medium">{entry.actorEmail}</span> {ACTION_LABEL[entry.action]}
                  {showOrgName && entry.target_org_id && (
                    <>
                      {" for "}
                      <Link href={`/admin/orgs/${entry.target_org_id}`} className="font-medium text-primary hover:underline">
                        {orgNameById[entry.target_org_id] ?? entry.target_org_id}
                      </Link>
                    </>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                </span>
              </div>
              {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
            </div>
          );
        })}
        {entries.length === 0 && <p className="px-6 py-4 text-sm text-muted-foreground">No activity yet.</p>}
      </CardContent>
    </Card>
  );
}
