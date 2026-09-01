"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Bot, CreditCard, Inbox, KeyRound, LogOut, Plug, Settings, ShieldCheck, Users, UsersRound, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ROLE_RANK, type Role } from "@velobot/shared";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, minRole: "admin" as Role, exact: true },
  { href: "/dashboard/bots", label: "Bots", icon: Bot, minRole: "admin" as Role },
  { href: "/inbox", label: "Inbox", icon: Inbox, minRole: "agent" as Role, newTab: true },
  { href: "/dashboard/team", label: "Team", icon: Users, minRole: "admin" as Role },
  { href: "/dashboard/queues", label: "Queues", icon: UsersRound, minRole: "admin" as Role },
  { href: "/dashboard/settings/connections", label: "Connections", icon: Plug, minRole: "admin" as Role },
  { href: "/dashboard/settings/actions", label: "Actions", icon: Zap, minRole: "admin" as Role },
  { href: "/dashboard/settings/api-keys", label: "Developer API", icon: KeyRound, minRole: "admin" as Role },
  { href: "/dashboard/settings/billing", label: "Billing", icon: CreditCard, minRole: "admin" as Role },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, minRole: "admin" as Role, exact: true },
];

export function DashboardNav({
  role,
  isSuperAdmin,
  userEmail,
}: {
  role: Role;
  isSuperAdmin: boolean;
  userEmail: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Scrollable middle — only this section scrolls if the nav list ever
          grows taller than the sidebar; the logo/switcher above and the
          user footer below stay fixed in place (see layout.tsx). */}
      <nav className="flex-1 overflow-y-auto px-5 py-1">
        <div className="flex flex-col gap-0.5">
          {isSuperAdmin && (
            <Link
              href="/admin"
              className="mb-3 flex items-center gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              <ShieldCheck className="h-4 w-4" /> Super Admin
            </Link>
          )}
          {NAV.filter((item) => ROLE_RANK[role] >= ROLE_RANK[item.minRole]).map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                {...(item.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {active && <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />}
                <item.icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="flex shrink-0 flex-col gap-2 border-t p-5 pt-3">
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase text-secondary-foreground">
            {userEmail.slice(0, 1) || "?"}
          </div>
          <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}
