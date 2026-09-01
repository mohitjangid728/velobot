"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bot, ChevronDown, LayoutGrid, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OrgSwitcher } from "@/components/dashboard/org-switcher";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Organization, Role } from "@velobot/shared";

export function InboxHeader({
  org,
  memberships,
  role,
  userEmail,
}: {
  org: Organization;
  memberships: { organizations: Organization }[];
  role: Role;
  userEmail: string;
}) {
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-5">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Bot className="h-3.5 w-3.5" />
          </div>
        </div>
        {memberships.length > 1 ? (
          <OrgSwitcher
            activeOrg={org}
            memberships={memberships}
            redirectTo="/inbox"
            showNewWorkspace={false}
            className="h-8 gap-1.5 px-2.5 text-sm font-semibold"
          />
        ) : (
          <span className="text-sm font-semibold">{org.name}</span>
        )}
        <span className="text-sm text-muted-foreground">Inbox</span>
      </div>

      <div className="flex items-center gap-1">
        {role === "admin" && (
          <Link
            href="/dashboard/bots"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LayoutGrid className="h-4 w-4" /> Dashboard
          </Link>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 rounded-lg py-1 pl-1.5 pr-2 text-sm transition-colors hover:bg-secondary">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase text-secondary-foreground">
                {userEmail.slice(0, 1) || "?"}
              </div>
              <span className="max-w-[160px] truncate text-muted-foreground">{userEmail}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{userEmail}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
