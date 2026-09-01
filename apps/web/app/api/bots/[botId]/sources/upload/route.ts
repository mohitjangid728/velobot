import { NextResponse, type NextRequest } from "next/server";
import { SOURCE_TYPES, type SourceType } from "@velobot/shared";
import { requireBotAccess } from "@/lib/auth/bot-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseDocument } from "@/lib/ingestion/parsers";
import { ingestDocuments } from "@/lib/ingestion/ingest-source";
import { assertCanIngestPages } from "@/lib/billing/guards";

export const runtime = "nodejs";
export const maxDuration = 120;

const EXTENSION_TO_TYPE: Record<string, SourceType> = {
  pdf: "pdf",
  docx: "docx",
  txt: "txt",
  md: "markdown",
  markdown: "markdown",
};

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: { botId: string } }) {
  const guard = await requireBotAccess(params.botId, "admin");
  if (!guard.ok) return guard.response;

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File exceeds 15MB limit" }, { status: 413 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const type = EXTENSION_TO_TYPE[ext];
  if (!type || !SOURCE_TYPES.includes(type)) {
    return NextResponse.json({ error: "Unsupported file type. Use PDF, DOCX, TXT, or Markdown." }, { status: 400 });
  }

  // A single document counts as one "page" toward the plan's page quota —
  // matches ingestDocuments() setting pages_crawled to the doc count (1) on
  // a successful upload.
  const pagesGuard = await assertCanIngestPages(guard.bot.org_id, 1);
  if (!pagesGuard.allowed) return NextResponse.json({ error: pagesGuard.reason }, { status: 402 });

  const admin = createSupabaseAdminClient();
  const { data: source, error: sourceError } = await admin
    .from("knowledge_sources")
    .insert({ bot_id: params.botId, type, file_path: file.name, status: "processing" })
    .select()
    .single();
  if (sourceError || !source) {
    return NextResponse.json({ error: sourceError?.message ?? "Failed to create source" }, { status: 500 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseDocument(type, buffer);
    const { chunksIngested } = await ingestDocuments(params.botId, source.id, [
      { title: parsed.title || file.name, text: parsed.text },
    ]);
    return NextResponse.json({ source, chunksIngested });
  } catch (err) {
    await admin
      .from("knowledge_sources")
      .update({ status: "failed", error_message: err instanceof Error ? err.message : "Parsing failed" })
      .eq("id", source.id);
    return NextResponse.json({ error: "Failed to parse or embed the file." }, { status: 500 });
  }
}
