import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NewBotForm } from "@/components/dashboard/new-bot-form";
import type { Queue } from "@velobot/shared";

export default async function NewBotPage() {
  const { org } = await requireRole("admin");
  const supabase = createSupabaseServerClient();
  const { data: queues } = await supabase
    .from("queues")
    .select("*")
    .eq("org_id", org.id)
    .order("created_at", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New bot</h1>
        <p className="text-sm text-muted-foreground">Set it up once — you can always fine-tune it later.</p>
      </div>
      <NewBotForm queues={(queues ?? []) as Queue[]} />
    </div>
  );
}
