import { Bot } from "lucide-react";
import { requireActiveOrg } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { OrgSwitcher } from "@/components/dashboard/org-switcher";
import { DashboardNav } from "@/components/dashboard/sidebar";
import { ImpersonationBanner } from "@/components/dashboard/impersonation-banner";
import { PastDueBanner } from "@/components/dashboard/past-due-banner";
import { UpgradeBanner } from "@/components/dashboard/upgrade-banner";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { org, role, memberships, user, impersonating } = await requireActiveOrg();
  const isSuperAdmin = await isPlatformAdmin(user.id);

  return (
    // `fixed inset-0` (not `h-screen`) — this pins the whole dashboard shell
    // to the viewport and takes it out of document flow entirely, so <body>
    // has no in-flow content to ever overflow. Without this, body/html keep
    // a few pixels of independent scroll slack even though <main> below is
    // the only element meant to scroll, which shows up as a blank flash
    // (and the sidebar visually "scrolling") on trackpad overscroll bounce.
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      {impersonating && <ImpersonationBanner orgName={org.name} />}
      {org.payment_status === "past_due" && <PastDueBanner />}
      {org.plan === "free" && org.payment_status !== "past_due" && <UpgradeBanner />}
      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-64 shrink-0 flex-col overflow-hidden border-r bg-card">
          <div className="flex shrink-0 flex-col gap-4 p-5">
            <div className="flex items-center gap-2 px-1 text-lg font-bold tracking-tight">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </div>
              VeloBot
            </div>
            <OrgSwitcher activeOrg={org} memberships={memberships} />
          </div>
          <DashboardNav role={role} isSuperAdmin={isSuperAdmin} userEmail={user.email ?? ""} />
        </aside>
        <main className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
