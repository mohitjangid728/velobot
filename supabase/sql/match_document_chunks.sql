-- RAG retrieval RPC: cosine-similarity search over document_chunks, scoped
-- strictly to a single bot_id so one tenant's bot can never surface another
-- tenant's (or another bot's) content. Called from lib/rag/retrieve.ts via
-- supabase.rpc('match_document_chunks', {...}).
--
-- This is a FUNCTION, not a table/schema definition, and is the one SQL
-- artifact this project ships per its scope (see docs/API.md). It assumes:
--   - the pgvector extension is enabled (`create extension if not exists vector;`)
--   - a `document_chunks` table exists with columns:
--       id uuid, bot_id uuid, content text, embedding vector(1536), metadata jsonb
--   - an ivfflat or hnsw index on `document_chunks (embedding vector_cosine_ops)`
--     for performance at scale, e.g.:
--       create index on document_chunks using hnsw (embedding vector_cosine_ops);

create or replace function match_document_chunks(
  query_embedding vector(1536),
  match_bot_id uuid,
  match_count int default 6,
  match_threshold float default 0.75
)
returns table (
  id uuid,
  content text,
  similarity float,
  metadata jsonb
)
language sql
stable
as $$
  select
    document_chunks.id,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) as similarity,
    document_chunks.metadata
  from document_chunks
  where document_chunks.bot_id = match_bot_id
    and 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
$$;
