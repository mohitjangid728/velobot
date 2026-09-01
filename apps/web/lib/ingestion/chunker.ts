import { getEncoding } from "js-tiktoken";
import { CHUNK_TOKEN_OVERLAP, CHUNK_TOKEN_SIZE } from "@velobot/shared";

// cl100k_base is the encoding used by both gpt-4o-mini and the
// text-embedding-3-* family, so token counts here match what OpenAI bills.
const encoding = getEncoding("cl100k_base");

export interface Chunk {
  content: string;
  tokenCount: number;
  chunkIndex: number;
}

/**
 * Token-aware sliding-window chunker. Splits on paragraph boundaries first
 * so chunks don't cut mid-sentence where possible, then falls back to a
 * raw token slide for any paragraph that alone exceeds the chunk size.
 */
export function chunkText(
  text: string,
  opts: { size?: number; overlap?: number } = {}
): Chunk[] {
  const size = opts.size ?? CHUNK_TOKEN_SIZE;
  const overlap = opts.overlap ?? CHUNK_TOKEN_OVERLAP;
  const step = Math.max(1, size - overlap);

  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];

  const tokens = encoding.encode(normalized);
  if (tokens.length <= size) {
    return [{ content: normalized, tokenCount: tokens.length, chunkIndex: 0 }];
  }

  const chunks: Chunk[] = [];
  let start = 0;
  let chunkIndex = 0;
  while (start < tokens.length) {
    const end = Math.min(start + size, tokens.length);
    const slice = tokens.slice(start, end);
    const content = encoding.decode(slice).trim();
    if (content) {
      chunks.push({ content, tokenCount: slice.length, chunkIndex: chunkIndex++ });
    }
    if (end === tokens.length) break;
    start += step;
  }
  return chunks;
}

export function countTokens(text: string): number {
  return encoding.encode(text).length;
}
