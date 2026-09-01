import { NextResponse, type NextRequest } from "next/server";
import { ROLE_RANK } from "@velobot/shared";
import { requireConversationAccess } from "@/lib/auth/conversation-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(_req: NextRequest, { params }: { params: { conversationId: string } }) {
  const guard = await requireConversationAccess(params.conversationId, "agent");
  if (!guard.ok) return guard.response;

  const { conversation, role, userId } = guard;
  const canForceResolve = ROLE_RANK[role] >= ROLE_RANK.admin;
  if (conversation.assigned_agent_id !== userId && !canForceResolve) {
    return NextResponse.json({ error: "Only the assigned agent (or an admin) can resolve this ticket." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data: resolved, error } = await admin
    .from("conversations")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", params.conversationId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("messages").insert({
    conversation_id: params.conversationId,
    role: "system",
    content: "Conversation resolved.",
  });

  return NextResponse.json({ conversation: resolved });
}
