"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Building2, CreditCard, FileText, History, LogOut, Search, Tag, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";

const ADMIN_NAV = [
  { href: "/admin", label: "Organizations", icon: Building2, exact: true },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/pricing", label: "Plans", icon: CreditCard },
  { href: "/admin/legal", label: "Legal pages", icon: FileText },
  { href: "/admin/coupons", label: "Coupons", icon: Tag },
  { href: "/admin/health", label: "System health", icon: Activity },
  { href: "/admin/admins", label: "Super Admins", icon: Users },
  { href: "/admin/activity", label: "Activity", icon: History },
];

export function AdminNav({ userEmail, onNavigate }: { userEmail: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/admin/search?q=${encodeURIComponent(query.trim())}`);
      onNavigate?.();
    }
  }

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <form onSubmit={submitSearch} className="relative shrink-0 px-5 pb-2">
        <Search className="pointer-events-none absolute left-8 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search everything..."
          className="h-8 pl-8 text-sm"
        />
      </form>
      <nav className="flex-1 overflow-y-auto px-5 py-1">
        <div className="flex flex-col gap-0.5">
          {ADMIN_NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
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
