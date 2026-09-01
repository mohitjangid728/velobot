import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePlatformAdmin();

  return <AdminShell userEmail={user.email ?? ""}>{children}</AdminShell>;
}
