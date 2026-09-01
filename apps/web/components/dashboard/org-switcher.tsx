"use client";

import { useRouter } from "next/navigation";
import { ChevronsUpDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { Organization } from "@velobot/shared";

export function OrgSwitcher({
  activeOrg,
  memberships,
  redirectTo = "/dashboard",
  showNewWorkspace = true,
  className,
}: {
  activeOrg: Organization;
  memberships: { organizations: Organization }[];
  /** Where to land after switching — agents land back on /inbox, everyone else on /dashboard. */
  redirectTo?: string;
  /** Agents don't create workspaces (they're invited into one), so the inbox header hides this. */
  showNewWorkspace?: boolean;
  className?: string;
}) {
  const router = useRouter();

  async function switchOrg(orgId: string) {
    if (orgId === activeOrg.id) return;
    await fetch(`/api/orgs/${orgId}/switch`, { method: "POST" });
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={className ?? "w-full justify-between"}>
          <span className="truncate">{activeOrg.name}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {memberships.map((m) => (
          <DropdownMenuItem key={m.organizations.id} onClick={() => switchOrg(m.organizations.id)}>
            {m.organizations.name}
          </DropdownMenuItem>
        ))}
        {showNewWorkspace && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/onboarding")}>
              <Plus className="mr-2 h-4 w-4" /> New workspace
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
