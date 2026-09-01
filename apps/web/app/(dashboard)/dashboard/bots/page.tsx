import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Plus, Bot as BotIcon, FileText, MessagesSquare, UsersRound, Clock } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Bot } from "@velobot/shared";

export default async function BotsPage() {
  const { org } = await requireRole("admin");
  const supabase = createSupabaseServerClient();
  const { data: bots } = await supabase
    .from("bots")
    .select("*")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false });

  const botList = (bots ?? []) as Bot[];
  const botIds = botList.map((b) => b.id);

  const [{ data: sources }, { data: conversations }, { data: queues }] = await Promise.all([
    botIds.length
      ? supabase.from("knowledge_sources").select("bot_id, pages_crawled").in("bot_id", botIds)
      : Promise.resolve({ data: [] as { bot_id: string; pages_crawled: number }[] }),
    botIds.length
      ? supabase.from("conversations").select("bot_id").in("bot_id", botIds)
      : Promise.resolve({ data: [] as { bot_id: string }[] }),
    supabase.from("queues").select("id, name").eq("org_id", org.id),
  ]);

  const pagesByBot = new Map<string, number>();
  for (const s of sources ?? []) pagesByBot.set(s.bot_id, (pagesByBot.get(s.bot_id) ?? 0) + (s.pages_crawled ?? 0));

  const conversationsByBot = new Map<string, number>();
  for (const c of conversations ?? []) conversationsByBot.set(c.bot_id, (conversationsByBot.get(c.bot_id) ?? 0) + 1);

  const queueNameById = new Map((queues ?? []).map((q) => [q.id, q.name]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bots</h1>
          <p className="text-sm text-muted-foreground">Create and manage your AI support bots.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/bots/new">
            <Plus className="mr-1 h-4 w-4" /> New bot
          </Link>
        </Button>
      </div>

      {botList.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BotIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium">No bots yet</p>
              <p className="text-sm text-muted-foreground">Create your first one to start training it on your content.</p>
            </div>
            <Button asChild className="mt-2">
              <Link href="/dashboard/bots/new">
                <Plus className="mr-1 h-4 w-4" /> New bot
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {botList.map((bot) => {
            const pages = pagesByBot.get(bot.id) ?? 0;
            const conversationCount = conversationsByBot.get(bot.id) ?? 0;
            const queueName = bot.queue_id ? queueNameById.get(bot.queue_id) : undefined;

            return (
              <Link key={bot.id} href={`/dashboard/bots/${bot.id}`} className="group">
                <Card className="flex h-full flex-col transition-all duration-150 group-hover:-translate-y-0.5 group-hover:shadow-card-hover">
                  <CardHeader className="flex-1 pb-4">
                    <div className="flex items-start justify-between gap-2">
                      {bot.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={bot.avatar_url} alt="" className="h-10 w-10 rounded-lg object-cover shadow-sm" />
                      ) : (
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
                          style={{ backgroundColor: bot.theme_color }}
                        >
                          <BotIcon className="h-5 w-5" />
                        </div>
                      )}
                      <Badge variant={bot.allowed_domains.length > 0 ? "success" : "secondary"} className="shrink-0">
                        {bot.allowed_domains.length > 0 ? "Embeddable" : "Draft"}
                      </Badge>
                    </div>
                    <CardTitle className="mt-2 text-base">{bot.name}</CardTitle>
                    <CardDescription className="line-clamp-2">{bot.description || "No description"}</CardDescription>
                    {queueName && (
                      <Badge variant="outline" className="mt-1 w-fit gap-1 font-normal">
                        <UsersRound className="h-3 w-3" /> {queueName}
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="flex items-center justify-between border-t px-6 py-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5" title="Pages indexed">
                      <FileText className="h-3.5 w-3.5" /> {pages}
                    </span>
                    <span className="flex items-center gap-1.5" title="Conversations">
                      <MessagesSquare className="h-3.5 w-3.5" /> {conversationCount}
                    </span>
                    <span className="flex items-center gap-1.5" title="Created">
                      <Clock className="h-3.5 w-3.5" /> {formatDistanceToNow(new Date(bot.created_at), { addSuffix: true })}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
