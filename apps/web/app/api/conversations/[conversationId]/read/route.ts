import { NextResponse, type NextRequest } from "next/server";
import { requireConversationAccess } from "@/lib/auth/conversation-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(_req: NextRequest, { params }: { params: { conversationId: string } }) {
  const guard = await requireConversationAccess(params.conversationId, "agent");
  if (!guard.ok) return guard.response;

  const admin = createSupabaseAdminClient();
  await admin.from("conversations").update({ unread_by_agent: false }).eq("id", params.conversationId);
  return NextResponse.json({ ok: true });
}
