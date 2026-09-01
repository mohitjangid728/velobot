import { NextResponse, type NextRequest } from "next/server";
import { RunActionSchema } from "@velobot/shared";
import { requireConversationAccess } from "@/lib/auth/conversation-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAction } from "@/lib/actions/actions-manager";
import { getConnection } from "@/lib/connections/connections-manager";
import { executeAction } from "@/lib/actions/executeAction";

export async function POST(req: NextRequest, { params }: { params: { conversationId: string; actionId: string } }) {
  const guard = await requireConversationAccess(params.conversationId, "agent");
  if (!guard.ok) return guard.response;

  const parsed = RunActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const action = await getAction(guard.conversation.org_id, params.actionId);
  if (!action || !action.bot_ids.includes(guard.conversation.bot_id)) {
    return NextResponse.json({ error: "Action not found" }, { status: 404 });
  }

  const connection = await getConnection(guard.conversation.org_id, action.connection_id);
  if (!connection) return NextResponse.json({ error: "Linked connection not found" }, { status: 404 });

  const result = await executeAction({ action, connection, params: parsed.data.params, source: "agent" });

  const admin = createSupabaseAdminClient();
  const note = result.ok
    ? `Agent ran "${action.name}" — HTTP ${result.status} OK`
    : `Agent ran "${action.name}" — failed${result.status ? ` (HTTP ${result.status})` : ""}: ${result.error}`;
  await admin.from("messages").insert({ conversation_id: params.conversationId, role: "system", content: note });

  return NextResponse.json(result);
}
