import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InboxApp } from "@/components/inbox/inbox-app";
import type { Conversation } from "@velobot/shared";

export default async function InboxPage() {
  const { org, role, user } = await requireRole("agent");
  const supabase = createSupabaseServerClient();

  const { data: myQueueMemberships } = await supabase.from("queue_members").select("queue_id").eq("user_id", user.id);
  const myQueueIds = (myQueueMemberships ?? []).map((m) => m.queue_id);

  // Admins see every conversation. An agent only ever receives
  // conversations with no queue (unrouted — anyone can pick these up) or one
  // of their own queues — enforced here so the payload itself never contains
  // out-of-scope data, matching the same boundary requireConversationAccess
  // enforces for every per-conversation action (messages, claim, resolve).
  let query = supabase
    .from("conversations")
    .select("*")
    .eq("org_id", org.id)
    .in("status", ["queued", "assigned", "resolved"])
    .order("last_message_at", { ascending: false })
    .limit(100);

  if (role === "agent") {
    query =
      myQueueIds.length > 0
        ? query.or(`queue_id.is.null,queue_id.in.(${myQueueIds.join(",")})`)
        : query.is("queue_id", null);
  }

  const { data: conversations } = await query;

  return (
    <InboxApp
      orgId={org.id}
      currentUserId={user.id}
      currentRole={role}
      initialConversations={(conversations ?? []) as Conversation[]}
      myQueueIds={myQueueIds}
    />
  );
}
