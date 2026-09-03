import { LegalPageShell } from "@/components/marketing/legal-page-shell";
import { MarkdownContent } from "@/components/marketing/markdown-content";
import { getLegalPage } from "@/lib/legal/content";

export const metadata = { title: "Sub-processors — VeloBot" };
export const dynamic = "force-dynamic";

export default async function SubprocessorsPage() {
  const page = await getLegalPage("subprocessors");
  return (
    <LegalPageShell title={page.title} updatedAt={new Date(page.updated_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}>
      <MarkdownContent markdown={page.content_markdown} />
    </LegalPageShell>
  );
}
