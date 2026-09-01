import "server-only";
import type { Bot, Conversation, ConversationSentiment, ExtractedEntities } from "@velobot/shared";
import { getOpenAI } from "@/lib/openai/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface ExtractionResult {
  intent: string | null;
  sentiment: ConversationSentiment | null;
  entities: ExtractedEntities;
}

/**
 * Best-effort, fire-and-forget: one cheap classification call over the
 * latest exchange, never awaited by the chat response (see the `void` call
 * site in app/api/chat/stream/route.ts) — a failure or slow response here
 * must never affect what the visitor sees. Surfaced to agents in
 * components/inbox/customer-panel.tsx, always as a hint, never as
 * verified data.
 */
export async function extractConversationData(
  bot: Bot,
  conversation: Conversation,
  message: string,
  history: { role: string; content: string }[]
): Promise<void> {
  try {
    const openai = getOpenAI();
    const recent = history
      .slice(-4)
      .map((h) => `${h.role}: ${h.content}`)
      .join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Extract structured metadata from a customer support conversation. Reply with ONLY a JSON object of this exact shape: {"intent": <a short 2-5 word label for what the visitor wants, or null if unclear>, "sentiment": "positive" | "neutral" | "negative", "entities": {<zero or more of "email", "phone", "order_id", "product", each mapped to the exact value the visitor stated, as plain strings>}}. Only include an entity if the visitor explicitly stated it in this conversation — never guess, infer, or fabricate a value.',
        },
        { role: "user", content: `Recent conversation:\n${recent || "(none yet)"}\n\nLatest visitor message: ${message}` },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return;

    const parsed = JSON.parse(raw) as Partial<ExtractionResult>;
    const admin = createSupabaseAdminClient();
    await admin
      .from("conversations")
      .update({
        extracted_intent: typeof parsed.intent === "string" ? parsed.intent.slice(0, 100) : null,
        extracted_sentiment: parsed.sentiment ?? null,
        extracted_entities: parsed.entities && typeof parsed.entities === "object" ? parsed.entities : null,
      })
      .eq("id", conversation.id);
  } catch (err) {
    // Fire-and-forget by design — log and move on, never surface to the visitor.
    console.error("[extract-data] Extraction failed", err);
  }
}
