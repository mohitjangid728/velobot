import "server-only";
import { NextResponse } from "next/server";
import { ROLE_RANK, type Conversation, type Role } from "@velobot/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getRoleForOrg } from "@/lib/auth/session";

type ConversationGuardResult =
  | { ok: true; conversation: Conversation; role: Role; userId: string }
  | { ok: false; response: NextResponse };

/**
 * Verifies the current user belongs to the conversation's org with at least
 * `minRole` (agents included by default), AND — for agents specifically —
 * that they're allowed into this conversation's queue. Admins see
 * every queue; an agent is scoped to conversations with no queue (unrouted,
 * anyone can pick these up) or a queue they're a member of. This is a real
 * boundary, not just an Inbox display filter: every route that reads or
 * mutates a conversation (messages, claim, resolve, execute-action) goes
 * through this one function, so fixing it here covers all of them.
 */
export async function requireConversationAccess(
  conversationId: string,
  minRole: Role = "agent"
): Promise<ConversationGuardResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const admin = createSupabaseAdminClient();
  const { data: conversation } = await admin
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conversation) {
    return { ok: false, response: NextResponse.json({ error: "Conversation not found" }, { status: 404 }) };
  }

  const role = await getRoleForOrg(user.id, conversation.org_id);
  if (!role || ROLE_RANK[role] < ROLE_RANK[minRole]) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  if (role === "agent" && conversation.queue_id) {
    const { data: membership } = await admin
      .from("queue_members")
      .select("queue_id")
      .eq("queue_id", conversation.queue_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) {
      return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
  }

  return { ok: true, conversation: conversation as Conversation, role, userId: user.id };
}
