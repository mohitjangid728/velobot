import { LegalPageShell } from "@/components/marketing/legal-page-shell";
import { MarkdownContent } from "@/components/marketing/markdown-content";
import { getLegalPage } from "@/lib/legal/content";

export const metadata = { title: "Privacy Policy — VeloBot" };
export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const page = await getLegalPage("privacy");
  return (
    <LegalPageShell title={page.title} updatedAt={new Date(page.updated_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}>
      <MarkdownContent markdown={page.content_markdown} />
    </LegalPageShell>
  );
}
