import "server-only";
import { RAG_MATCH_COUNT, RAG_MATCH_THRESHOLD, type MatchedChunk } from "@velobot/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { embedOne } from "@/lib/ingestion/embed";

/**
 * Embeds `query` and calls the match_document_chunks RPC (supabase/sql),
 * scoped strictly to `botId` — this is the tenant/bot isolation boundary
 * for retrieval, see docs/SECURITY.md.
 */
export async function retrieveContext(botId: string, query: string): Promise<MatchedChunk[]> {
  const embedding = await embedOne(query);
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin.rpc("match_document_chunks", {
    query_embedding: embedding,
    match_bot_id: botId,
    match_count: RAG_MATCH_COUNT,
    match_threshold: RAG_MATCH_THRESHOLD,
  });

  if (error) throw error;
  return (data ?? []) as MatchedChunk[];
}
