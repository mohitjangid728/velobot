import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { LegalPage, LegalPageSlug } from "@velobot/shared";

/** Falls back to a minimal placeholder if the row is somehow missing (e.g. before the seed migration ran) rather than crashing a public marketing page. */
const FALLBACK: Record<LegalPageSlug, Pick<LegalPage, "title" | "content_markdown">> = {
  terms: { title: "Terms of Service", content_markdown: "_This page hasn't been configured yet._" },
  privacy: { title: "Privacy Policy", content_markdown: "_This page hasn't been configured yet._" },
  subprocessors: { title: "Sub-processors", content_markdown: "_This page hasn't been configured yet._" },
};

export async function getLegalPage(slug: LegalPageSlug): Promise<LegalPage> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("legal_pages").select("*").eq("slug", slug).maybeSingle();
  if (data) return data as LegalPage;
  return { slug, updated_by: null, updated_at: new Date().toISOString(), ...FALLBACK[slug] };
}

export async function updateLegalPage(
  slug: LegalPageSlug,
  input: { title: string; content_markdown: string; updatedBy: string }
): Promise<LegalPage> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("legal_pages")
    .upsert(
      {
        slug,
        title: input.title,
        content_markdown: input.content_markdown,
        updated_by: input.updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" }
    )
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to save legal page");
  return data as LegalPage;
}
