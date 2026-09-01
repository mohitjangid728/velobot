import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { QueueManager } from "@/components/dashboard/queue-manager";
import type { Queue, QueueMember } from "@velobot/shared";

export default async function QueuesPage() {
  const { org } = await requireRole("admin");
  const supabase = createSupabaseServerClient();

  const { data: queues } = await supabase
    .from("queues")
    .select("*")
    .eq("org_id", org.id)
    .order("created_at", { ascending: true });

  const queueIds = (queues ?? []).map((q) => q.id);
  const { data: queueMembers } = queueIds.length
    ? await supabase.from("queue_members").select("*").in("queue_id", queueIds)
    : { data: [] };

  const { data: orgMembers } = await supabase.from("org_members").select("*").eq("org_id", org.id).eq("status", "active");
  const { data: bots } = await supabase.from("bots").select("id, name, queue_id").eq("org_id", org.id);

  // org_members has no email column — resolve display emails via the admin
  // client for this admin-only screen, same pattern as dashboard/team.
  const admin = createSupabaseAdminClient();
  const membersWithEmail = await Promise.all(
    (orgMembers ?? []).map(async (m) => {
      if (!m.user_id) return { userId: "", email: m.invited_email ?? "" };
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      return { userId: m.user_id, email: data.user?.email ?? "" };
    })
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Queues</h1>
        <p className="text-sm text-muted-foreground">
          Group agents into queues, then assign a queue to a bot under its Settings tab — &ldquo;Talk
          to a human&rdquo; routes only to that queue&apos;s members instead of the whole team.
        </p>
      </div>
      <QueueManager
        orgId={org.id}
        initialQueues={(queues ?? []) as Queue[]}
        initialQueueMembers={(queueMembers ?? []) as QueueMember[]}
        orgMembers={membersWithEmail.filter((m) => m.userId)}
        bots={(bots ?? []) as { id: string; name: string; queue_id: string | null }[]}
      />
    </div>
  );
}
