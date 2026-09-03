import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { getLegalPage } from "@/lib/legal/content";
import { Card, CardContent } from "@/components/ui/card";
import type { LegalPageSlug } from "@velobot/shared";

const PAGES: { slug: LegalPageSlug; label: string }[] = [
  { slug: "terms", label: "Terms of Service" },
  { slug: "privacy", label: "Privacy Policy" },
  { slug: "subprocessors", label: "Sub-processors" },
];

export default async function AdminLegalPage() {
  await requirePlatformAdmin();
  const pages = await Promise.all(PAGES.map(async (p) => ({ ...p, page: await getLegalPage(p.slug) })));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Legal pages</h1>
        <p className="text-sm text-muted-foreground">Edit the content shown on the public /legal/* pages.</p>
      </div>
      <Card>
        <CardContent className="flex flex-col divide-y p-0">
          {pages.map(({ slug, label, page }) => (
            <Link
              key={slug}
              href={`/admin/legal/${slug}`}
              className="flex items-center justify-between px-6 py-4 text-sm transition-colors hover:bg-secondary/60"
            >
              <div>
                <p className="font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">
                  Last updated {new Date(page.updated_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
