import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function StatTile({
  label,
  value,
  caption,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  caption?: string;
  icon: LucideIcon;
  tone?: "default" | "good" | "warning";
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            tone === "good" && "bg-status-good-bg text-status-good",
            tone === "warning" && "bg-status-warning-bg text-status-warning",
            tone === "default" && "bg-primary/10 text-primary"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      {caption && <p className="mt-1 text-xs text-muted-foreground">{caption}</p>}
    </Card>
  );
}
