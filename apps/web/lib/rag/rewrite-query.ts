import "server-only";
import { getOpenAI, CHAT_MODEL } from "@/lib/openai/client";
import type { ChatStreamRequest } from "@velobot/shared";

const REWRITE_SYSTEM_PROMPT = `You rewrite a website visitor's latest chat
message into a standalone search query for retrieving relevant passages
from that business's own website/documentation.

This is a customer support widget embedded on a COMPANY's site. In the
visitor's messages, "you"/"your"/"yourself" refer to that company or its
product — NEVER to you, the AI assistant. So "Tell me about yourself" means
"Tell me about the company", and "What do you offer?" means "What
services/products does the company offer?", not a question about the
assistant's own capabilities.

Resolve pronouns and implicit references using the conversation history
(e.g. after discussing a specific product, "How much does it cost?"
becomes "How much does <product> cost?"). If the company/product name
isn't known from context, phrase the query generically around the topic
(e.g. "services offered", "pricing", "refund policy") rather than
referencing "the assistant" or "the AI". Output ONLY the rewritten query,
no explanation. If the message is already standalone, return it unchanged.`;

/**
 * Multi-turn query rewriting: without this, a follow-up like "how much
 * does it cost?" embeds and retrieves poorly because "it" carries no
 * semantic signal on its own.
 */
export async function rewriteQueryForRetrieval(
  message: string,
  history: ChatStreamRequest["history"]
): Promise<string> {
  if (history.length === 0) return message;

  const openai = getOpenAI();
  const transcript = history
    .slice(-6)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  try {
    const res = await openai.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0,
      max_tokens: 120,
      messages: [
        { role: "system", content: REWRITE_SYSTEM_PROMPT },
        { role: "user", content: `Conversation so far:\n${transcript}\n\nLatest message: ${message}` },
      ],
    });
    return res.choices[0]?.message?.content?.trim() || message;
  } catch {
    // Retrieval quality degrades gracefully rather than the whole request failing.
    return message;
  }
}
