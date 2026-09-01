import { requireRole } from "@/lib/auth/session";
import { OrgSettingsForm } from "@/components/dashboard/org-settings-form";

export default async function SettingsPage() {
  const { org } = await requireRole("admin");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Workspace settings</h1>
      <OrgSettingsForm org={org} />
    </div>
  );
}
