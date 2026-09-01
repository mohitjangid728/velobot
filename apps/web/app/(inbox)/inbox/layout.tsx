import { requireRole } from "@/lib/auth/session";
import { InboxHeader } from "@/components/inbox/inbox-header";

export default async function InboxLayout({ children }: { children: React.ReactNode }) {
  const { org, role, user, memberships } = await requireRole("agent");

  return (
    <div className="flex h-screen flex-col bg-background">
      <InboxHeader
        org={org}
        memberships={memberships}
        role={role}
        userEmail={user.email ?? ""}
      />
      <div className="min-h-0 flex-1 bg-card">{children}</div>
    </div>
  );
}
