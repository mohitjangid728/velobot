"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ImpersonationBanner({ orgName }: { orgName: string }) {
  const router = useRouter();
  const [exiting, setExiting] = useState(false);

  async function exit() {
    setExiting(true);
    await fetch("/api/admin/exit-impersonation", { method: "POST" });
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-sm text-white">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4" />
        Viewing <strong>{orgName}</strong> as Super Admin — changes you make here are real.
      </div>
      <Button size="sm" variant="secondary" onClick={exit} disabled={exiting}>
        {exiting ? "Exiting..." : "Exit impersonation"}
      </Button>
    </div>
  );
}
