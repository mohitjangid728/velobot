import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PastDueBanner() {
  return (
    <div className="flex items-center justify-between gap-3 bg-status-critical px-4 py-2 text-sm text-white">
      <div className="flex items-center gap-2">
        <CircleAlert className="h-4 w-4" />
        Your last payment failed. Update your payment method to avoid losing access.
      </div>
      <Button asChild size="sm" variant="secondary">
        <Link href="/dashboard/settings/billing">Update billing</Link>
      </Button>
    </div>
  );
}
