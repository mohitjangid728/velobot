import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { getLegalPage } from "@/lib/legal/content";
import { LegalPageEditor } from "@/components/admin/legal-page-editor";
import type { LegalPageSlug } from "@velobot/shared";

const VALID_SLUGS: LegalPageSlug[] = ["terms", "privacy", "subprocessors"];

export default async function AdminLegalPageEditorPage({ params }: { params: { slug: string } }) {
  const user = await requirePlatformAdmin();
  if (!VALID_SLUGS.includes(params.slug as LegalPageSlug)) notFound();
  const slug = params.slug as LegalPageSlug;
  const page = await getLegalPage(slug);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{page.title}</h1>
        <p className="text-sm text-muted-foreground">Editing the public /legal/{slug} page. Content is written in Markdown.</p>
      </div>
      <LegalPageEditor slug={slug} initialPage={page} canManage={user.platformAdminRole === "full"} />
    </div>
  );
}
