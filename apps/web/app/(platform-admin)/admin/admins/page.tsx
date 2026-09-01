import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PlatformAdminsManager } from "@/components/admin/platform-admins-manager";
import type { PlatformAdmin } from "@velobot/shared";

export default async function AdminAdminsPage() {
  const user = await requirePlatformAdmin();
  const admin = createSupabaseAdminClient();

  const { data: rows } = await admin.from("platform_admins").select("*").order("created_at", { ascending: false });

  const withEmail = await Promise.all(
    (rows ?? []).map(async (row) => {
      const { data } = await admin.auth.admin.getUserById(row.user_id);
      return { ...(row as PlatformAdmin), email: data.user?.email ?? "" };
    })
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Super Admins</h1>
        <p className="text-sm text-muted-foreground">Users with platform-wide access, independent of any workspace membership.</p>
      </div>
      <PlatformAdminsManager currentUserId={user.id} initialAdmins={withEmail} canManage={user.platformAdminRole === "full"} />
    </div>
  );
}
