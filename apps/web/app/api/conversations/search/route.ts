import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getActiveOrg } from "@/lib/auth/session";
import type { Conversation } from "@velobot/shared";

const MAX_RESULTS = 50;

/**
 * Text search across an org's conversations — visitor email/session id
 * directly, plus a match against any message's content (via the
 * conversations!inner embedded-resource filter, same pattern as
 * lib/billing/usage.ts#getMessagesUsedThisPeriod). Queue-scoped for an
 * agent exactly like the inbox page's initial load — an agent can't use
 * search to see conversations requireConversationAccess would reject them
 * from opening.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { org, role } = await getActiveOrg();
  if (!org || !role) return NextResponse.json({ error: "No active workspace" }, { status: 400 });

  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ conversations: [] });

  const admin = createSupabaseAdminClient();
  const { data: myQueueMemberships } = await admin.from("queue_members").select("queue_id").eq("user_id", user.id);
  const myQueueIds = (myQueueMemberships ?? []).map((m) => m.queue_id);

  const like = `%${q}%`;

  let directQuery = admin
    .from("conversations")
    .select("*")
    .eq("org_id", org.id)
    .or(`visitor_email.ilike.${like},session_id.ilike.${like}`)
    .order("last_message_at", { ascending: false })
    .limit(MAX_RESULTS);
  if (role === "agent") {
    directQuery =
      myQueueIds.length > 0
        ? directQuery.or(`queue_id.is.null,queue_id.in.(${myQueueIds.join(",")})`)
        : directQuery.is("queue_id", null);
  }

  let messageMatchQuery = admin
    .from("messages")
    .select("conversation_id, conversations!inner(org_id, queue_id)")
    .ilike("content", like)
    .eq("conversations.org_id", org.id)
    .limit(MAX_RESULTS);
  if (role === "agent") {
    messageMatchQuery =
      myQueueIds.length > 0
        ? messageMatchQuery.or(`queue_id.is.null,queue_id.in.(${myQueueIds.join(",")})`, { referencedTable: "conversations" })
        : messageMatchQuery.is("conversations.queue_id", null);
  }

  const [{ data: directMatches }, { data: messageMatches }] = await Promise.all([directQuery, messageMatchQuery]);

  const conversationIds = [...new Set((messageMatches ?? []).map((m) => m.conversation_id))].slice(0, MAX_RESULTS);
  const { data: fromMessages } =
    conversationIds.length > 0
      ? await admin.from("conversations").select("*").in("id", conversationIds)
      : { data: [] };

  const byId = new Map<string, Conversation>();
  for (const c of [...(directMatches ?? []), ...(fromMessages ?? [])]) byId.set(c.id, c as Conversation);

  const results = [...byId.values()].sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

  return NextResponse.json({ conversations: results.slice(0, MAX_RESULTS) });
}
