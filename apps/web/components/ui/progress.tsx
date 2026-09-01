import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  tone?: "default" | "warning" | "critical";
}

const TONE_CLASS: Record<NonNullable<ProgressProps["tone"]>, string> = {
  default: "bg-primary",
  warning: "bg-status-warning",
  critical: "bg-status-critical",
};

function Progress({ value, tone = "default", className, ...props }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)} {...props}>
      <div
        className={cn("h-full rounded-full transition-all", TONE_CLASS[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export { Progress };
