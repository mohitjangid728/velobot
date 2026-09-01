import { NextResponse, type NextRequest } from "next/server";
import { SendAgentMessageSchema } from "@velobot/shared";
import { requireConversationAccess } from "@/lib/auth/conversation-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(_req: NextRequest, { params }: { params: { conversationId: string } }) {
  const guard = await requireConversationAccess(params.conversationId, "agent");
  if (!guard.ok) return guard.response;

  const admin = createSupabaseAdminClient();
  const { data: messages, error } = await admin
    .from("messages")
    .select("*")
    .eq("conversation_id", params.conversationId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest, { params }: { params: { conversationId: string } }) {
  const guard = await requireConversationAccess(params.conversationId, "agent");
  if (!guard.ok) return guard.response;

  if (guard.conversation.status !== "assigned" || guard.conversation.assigned_agent_id !== guard.userId) {
    return NextResponse.json({ error: "You must claim this ticket before replying." }, { status: 403 });
  }

  const parsed = SendAgentMessageSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: message, error } = await admin
    .from("messages")
    .insert({
      conversation_id: params.conversationId,
      role: "agent",
      content: parsed.data.content,
      agent_id: guard.userId,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", params.conversationId);

  return NextResponse.json({ message });
}
