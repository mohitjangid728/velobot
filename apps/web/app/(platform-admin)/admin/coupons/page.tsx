import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CouponsManager } from "@/components/admin/coupons-manager";
import type { Coupon } from "@velobot/shared";

export default async function AdminCouponsPage() {
  const user = await requirePlatformAdmin();
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("coupons").select("*").order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Coupons</h1>
        <p className="text-sm text-muted-foreground">Create discount codes for the messages add-on or plan subscriptions.</p>
      </div>
      <CouponsManager initialCoupons={(data ?? []) as Coupon[]} canManage={user.platformAdminRole === "full"} />
    </div>
  );
}
