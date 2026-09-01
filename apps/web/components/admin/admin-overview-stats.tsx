import { Building2, Bot, Users, Ban } from "lucide-react";
import { PLAN_TIERS, PLANS, type PlanTier } from "@velobot/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface OverviewStats {
  totalOrgs: number;
  suspendedOrgs: number;
  totalBots: number;
  totalMembers: number;
  planCounts: Record<PlanTier, number>;
}

function StatTile({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: number }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <span className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</span>
    </Card>
  );
}

export function AdminOverviewStats({ stats }: { stats: OverviewStats }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Building2} label="Organizations" value={stats.totalOrgs} />
        <StatTile icon={Bot} label="Bots" value={stats.totalBots} />
        <StatTile icon={Users} label="Active members" value={stats.totalMembers} />
        <StatTile icon={Ban} label="Suspended" value={stats.suspendedOrgs} />
      </div>
      <Card className="flex flex-wrap items-center gap-2 p-4">
        <span className="text-xs font-medium text-muted-foreground">By plan:</span>
        {PLAN_TIERS.map((tier) => (
          <Badge key={tier} variant="outline">
            {PLANS[tier].name}: {stats.planCounts[tier] ?? 0}
          </Badge>
        ))}
      </Card>
    </div>
  );
}
