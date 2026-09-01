import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PLANS } from "@velobot/shared";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OrgRow } from "@/components/admin/orgs-table";

const THRESHOLD = 0.9;

function nearLimitReasons(org: OrgRow): string[] {
  const plan = PLANS[org.plan];
  const messageLimit = plan.quota.messagesPerMonth + org.addon_message_balance;
  const reasons: string[] = [];
  if (messageLimit > 0 && org.usage.messagesThisPeriod / messageLimit >= THRESHOLD) {
    reasons.push(`${org.usage.messagesThisPeriod.toLocaleString()}/${messageLimit.toLocaleString()} messages`);
  }
  if (plan.quota.pages > 0 && org.usage.pages / plan.quota.pages >= THRESHOLD) {
    reasons.push(`${org.usage.pages}/${plan.quota.pages} pages`);
  }
  if (plan.quota.bots > 0 && org.usage.bots / plan.quota.bots >= THRESHOLD) {
    reasons.push(`${org.usage.bots}/${plan.quota.bots} bots`);
  }
  return reasons;
}

export function NearLimitCard({ orgs }: { orgs: OrgRow[] }) {
  const flagged = orgs.filter((o) => !o.suspended_at && nearLimitReasons(o).length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-status-warning" /> Near quota limit
        </CardTitle>
        <CardDescription>Workspaces at 90%+ of a plan limit — either an upsell opportunity or worth a closer look.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y p-0">
        {flagged.map((org) => (
          <Link
            key={org.id}
            href={`/admin/orgs/${org.id}`}
            className="flex flex-wrap items-center justify-between gap-2 px-6 py-2 text-sm hover:bg-muted/40"
          >
            <span className="font-medium text-primary">{org.name}</span>
            <span className="flex flex-wrap gap-1.5">
              {nearLimitReasons(org).map((reason) => (
                <Badge key={reason} variant="warning">
                  {reason}
                </Badge>
              ))}
            </span>
          </Link>
        ))}
        {flagged.length === 0 && <p className="px-6 py-4 text-sm text-muted-foreground">No workspace is near a limit right now.</p>}
      </CardContent>
    </Card>
  );
}
