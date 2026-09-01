"use client";

import { useState } from "react";
import { Bot, Menu, ShieldCheck, X } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-sidebar";
import { cn } from "@/lib/utils";

function Logo() {
  return (
    <div className="flex shrink-0 flex-col gap-1 p-5">
      <div className="flex items-center gap-2 px-1 text-lg font-bold tracking-tight">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Bot className="h-4 w-4" />
        </div>
        VeloBot
      </div>
      <span className="flex items-center gap-1.5 px-1 text-xs font-medium text-primary">
        <ShieldCheck className="h-3.5 w-3.5" /> Super Admin
      </span>
    </div>
  );
}

export function AdminShell({ userEmail, children }: { userEmail: string; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      {/* Mobile top bar — hidden at lg and up, where the sidebar is always visible instead. */}
      <div className="flex shrink-0 items-center justify-between border-b bg-card p-3 lg:hidden">
        <div className="flex items-center gap-2 px-1 text-base font-bold tracking-tight">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Bot className="h-3.5 w-3.5" />
          </div>
          VeloBot
          <ShieldCheck className="ml-1 h-3.5 w-3.5 text-primary" />
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {mobileOpen && (
          <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden />
        )}

        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col overflow-hidden border-r bg-card transition-transform duration-200 lg:static lg:translate-x-0",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between">
            <Logo />
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="mr-4 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <AdminNav userEmail={userEmail} onNavigate={() => setMobileOpen(false)} />
        </aside>

        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
