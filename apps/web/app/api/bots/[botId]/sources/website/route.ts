import { NextResponse, type NextRequest } from "next/server";
import { IngestWebsiteSchema } from "@velobot/shared";
import { requireBotAccess } from "@/lib/auth/bot-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { crawlWebsite } from "@/lib/ingestion/crawler";
import { ingestDocuments } from "@/lib/ingestion/ingest-source";
import { assertCanIngestPages } from "@/lib/billing/guards";

// Node runtime required: the crawler + PDF/DOCX parsers used elsewhere in
// this module depend on Node APIs unavailable on the Edge runtime.
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: { botId: string } }) {
  const guard = await requireBotAccess(params.botId, "admin");
  if (!guard.ok) return guard.response;

  const parsed = IngestWebsiteSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // parsed.data.max_pages is an arbitrary safety cap on the crawl, not a
  // real request for that many pages, so a plan with any headroom at all
  // should still crawl (up to that headroom) rather than being rejected
  // outright just because the cap itself exceeds the plan limit — see
  // allowedPages's doc comment in guards.ts. Only a plan with zero
  // remaining headroom is rejected here, before any crawling happens.
  const pagesGuard = await assertCanIngestPages(guard.bot.org_id, parsed.data.max_pages);
  if (!pagesGuard.allowed) return NextResponse.json({ error: pagesGuard.reason }, { status: 402 });
  const maxPages = pagesGuard.allowedPages ?? parsed.data.max_pages;

  const admin = createSupabaseAdminClient();
  const { data: source, error: sourceError } = await admin
    .from("knowledge_sources")
    .insert({ bot_id: params.botId, type: "website", source_url: parsed.data.url, status: "crawling" })
    .select()
    .single();
  if (sourceError || !source) {
    return NextResponse.json({ error: sourceError?.message ?? "Failed to create source" }, { status: 500 });
  }

  try {
    const pages = await crawlWebsite(parsed.data.url, { maxPages });
    await admin.from("knowledge_sources").update({ status: "processing", pages_crawled: pages.length }).eq("id", source.id);

    const { chunksIngested } = await ingestDocuments(
      params.botId,
      source.id,
      pages.map((p) => ({ title: p.title, url: p.url, text: p.text }))
    );

    return NextResponse.json({ source, pagesCrawled: pages.length, chunksIngested });
  } catch (err) {
    await admin
      .from("knowledge_sources")
      .update({ status: "failed", error_message: err instanceof Error ? err.message : "Crawl failed" })
      .eq("id", source.id);
    return NextResponse.json({ error: "Crawl failed. Check the source status for details." }, { status: 500 });
  }
}
