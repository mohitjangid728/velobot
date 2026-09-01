import "server-only";
import { EMBEDDING_BATCH_SIZE } from "@velobot/shared";
import { getOpenAI, EMBEDDING_MODEL } from "@/lib/openai/client";

/** Batches texts into OpenAI embedding calls of at most EMBEDDING_BATCH_SIZE inputs each. */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const openai = getOpenAI();
  const vectors: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: batch });
    // OpenAI preserves input order in the response.
    vectors.push(...res.data.map((d) => d.embedding));
  }

  return vectors;
}

export async function embedOne(text: string): Promise<number[]> {
  const [vector] = await embedBatch([text]);
  return vector!;
}
