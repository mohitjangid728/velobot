import { NextResponse, type NextRequest } from "next/server";
import { requireConversationAccess } from "@/lib/auth/conversation-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(_req: NextRequest, { params }: { params: { conversationId: string } }) {
  const guard = await requireConversationAccess(params.conversationId, "agent");
  if (!guard.ok) return guard.response;

  const admin = createSupabaseAdminClient();

  // Optimistic concurrency: only succeeds if the conversation is still
  // `queued`, so two agents clicking "claim" at once can't both win it.
  const { data: claimed, error } = await admin
    .from("conversations")
    .update({ status: "assigned", assigned_agent_id: guard.userId, assigned_at: new Date().toISOString() })
    .eq("id", params.conversationId)
    .eq("status", "queued")
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!claimed) return NextResponse.json({ error: "This ticket was already claimed by another agent." }, { status: 409 });

  await admin.from("messages").insert({
    conversation_id: params.conversationId,
    role: "system",
    content: "An agent joined the conversation.",
  });

  return NextResponse.json({ conversation: claimed });
}
