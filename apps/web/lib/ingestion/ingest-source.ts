import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { chunkText } from "@/lib/ingestion/chunker";
import { embedBatch } from "@/lib/ingestion/embed";

export interface IngestableDocument {
  title: string;
  url?: string;
  text: string;
}

/**
 * Chunks + embeds a set of documents belonging to one knowledge source and
 * upserts them as document_chunks rows. Shared by both the website crawler
 * and the file-upload path so chunking/embedding logic never diverges.
 */
export async function ingestDocuments(botId: string, sourceId: string, docs: IngestableDocument[]) {
  const admin = createSupabaseAdminClient();

  type PendingChunk = { content: string; token_count: number; metadata: Record<string, unknown> };
  const pending: PendingChunk[] = [];

  for (const doc of docs) {
    const chunks = chunkText(doc.text);
    for (const chunk of chunks) {
      pending.push({
        content: chunk.content,
        token_count: chunk.tokenCount,
        metadata: { title: doc.title, url: doc.url, chunk_index: chunk.chunkIndex },
      });
    }
  }

  if (pending.length === 0) {
    await admin
      .from("knowledge_sources")
      .update({ status: "failed", error_message: "No extractable text found." })
      .eq("id", sourceId);
    return { chunksIngested: 0 };
  }

  const embeddings = await embedBatch(pending.map((p) => p.content));

  const rows = pending.map((p, i) => ({
    bot_id: botId,
    source_id: sourceId,
    content: p.content,
    embedding: embeddings[i],
    token_count: p.token_count,
    metadata: p.metadata,
  }));

  // Batch the insert to stay well under typical request/body size limits.
  const INSERT_BATCH = 200;
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const { error } = await admin.from("document_chunks").insert(rows.slice(i, i + INSERT_BATCH));
    if (error) {
      await admin.from("knowledge_sources").update({ status: "failed", error_message: error.message }).eq("id", sourceId);
      throw error;
    }
  }

  await admin
    .from("knowledge_sources")
    .update({ status: "ready", pages_crawled: docs.length })
    .eq("id", sourceId);

  return { chunksIngested: rows.length };
}
