import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UpgradeBanner() {
  return (
    <div className="flex items-center justify-between gap-3 bg-primary px-4 py-2 text-sm text-primary-foreground">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0" />
        You&apos;re on the Free plan. Upgrade for more bots, pages, and messages.
      </div>
      <Button asChild size="sm" variant="secondary" className="shrink-0">
        <Link href="/dashboard/settings/billing">Upgrade plan</Link>
      </Button>
    </div>
  );
}
