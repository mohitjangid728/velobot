import { Gauge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { AgentWorkload } from "@/lib/analysis/agent-metrics";

export function AgentWorkloadPanel({ workload, emailByUserId }: { workload: AgentWorkload[]; emailByUserId: Map<string, string> }) {
  if (workload.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="h-4 w-4" /> Agent workload
        </CardTitle>
        <CardDescription>Resolved conversations and average resolution time, all-time</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y p-0">
        {workload.map((w) => (
          <div key={w.userId} className="flex items-center justify-between gap-4 p-4">
            <p className="truncate text-sm font-medium">{emailByUserId.get(w.userId) ?? "Former teammate"}</p>
            <div className="flex shrink-0 items-center gap-4 text-sm text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">{w.resolvedCount}</span> resolved
              </span>
              <span>
                {w.avgResolutionMinutes !== null ? (
                  <>
                    avg <span className="font-semibold text-foreground">{Math.round(w.avgResolutionMinutes)}m</span>
                  </>
                ) : (
                  "no timing data"
                )}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
