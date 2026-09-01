import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Bot, MessagesSquare, CircleAlert, CheckCircle2, Users, ArrowUpRight } from "lucide-react";
import { requireActiveOrg } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PLANS } from "@velobot/shared";
import { StatTile } from "@/components/dashboard/stat-tile";
import { AnalyticsPanel } from "@/components/dashboard/analytics-panel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getConversationVolumeByDay,
  getDeflectionRate,
  getSentimentBreakdown,
  getTopIntents,
  getAverageRating,
} from "@/lib/analysis/dashboard-metrics";
import type { Conversation, ConversationStatus } from "@velobot/shared";

const STATUS_LABEL: Record<ConversationStatus, string> = {
  ai: "With AI",
  queued: "Waiting for agent",
  assigned: "With agent",
  resolved: "Resolved",
};

const STATUS_VARIANT: Record<ConversationStatus, "secondary" | "warning" | "default" | "success"> = {
  ai: "secondary",
  queued: "warning",
  assigned: "default",
  resolved: "success",
};

export default async function DashboardOverviewPage() {
  const { org, role } = await requireActiveOrg();
  if (role === "agent") redirect("/inbox");

  const supabase = createSupabaseServerClient();

  const [{ count: botCount }, { count: memberCount }, { count: totalConversations }, { count: queuedCount }, { count: resolvedCount }, { data: recent }] =
    await Promise.all([
      supabase.from("bots").select("id", { count: "exact", head: true }).eq("org_id", org.id),
      supabase.from("org_members").select("id", { count: "exact", head: true }).eq("org_id", org.id).eq("status", "active"),
      supabase.from("conversations").select("id", { count: "exact", head: true }).eq("org_id", org.id),
      supabase.from("conversations").select("id", { count: "exact", head: true }).eq("org_id", org.id).eq("status", "queued"),
      supabase.from("conversations").select("id", { count: "exact", head: true }).eq("org_id", org.id).eq("status", "resolved"),
      supabase
        .from("conversations")
        .select("*")
        .eq("org_id", org.id)
        .order("last_message_at", { ascending: false })
        .limit(8),
    ]);

  const recentConversations = (recent ?? []) as Conversation[];
  const botIds = [...new Set(recentConversations.map((c) => c.bot_id))];
  const { data: bots } = botIds.length
    ? await supabase.from("bots").select("id, name").in("id", botIds)
    : { data: [] };
  const botNameById = new Map((bots ?? []).map((b) => [b.id, b.name]));

  const limits = PLANS[org.plan].quota;

  const [volume, deflection, sentiment, topIntents, averageRating] = await Promise.all([
    getConversationVolumeByDay(org.id),
    getDeflectionRate(org.id),
    getSentimentBreakdown(org.id),
    getTopIntents(org.id),
    getAverageRating(org.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Welcome back to {org.name}.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Bots"
          value={`${botCount ?? 0} / ${limits.bots}`}
          caption="Active support bots"
          icon={Bot}
        />
        <StatTile
          label="Conversations"
          value={totalConversations ?? 0}
          caption="All-time, across every bot"
          icon={MessagesSquare}
        />
        <StatTile
          label="Needs attention"
          value={queuedCount ?? 0}
          caption="Waiting in queue right now"
          icon={CircleAlert}
          tone={(queuedCount ?? 0) > 0 ? "warning" : "default"}
        />
        <StatTile
          label="Resolved"
          value={resolvedCount ?? 0}
          caption="Handled by your team"
          icon={CheckCircle2}
          tone="good"
        />
      </div>

      <AnalyticsPanel volume={volume} deflection={deflection} sentiment={sentiment} topIntents={topIntents} averageRating={averageRating} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Recent conversations</CardTitle>
              <CardDescription>Across all your bots</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/inbox">
                Open inbox <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentConversations.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
                No conversations yet — embed a bot on your site to start seeing activity here.
              </p>
            ) : (
              <div className="flex flex-col divide-y">
                {recentConversations.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-4 px-6 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {c.visitor_email || `Visitor · ${c.session_id.slice(0, 8)}`}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {botNameById.get(c.bot_id) ?? "Bot"} · {c.visitor_url ?? "Unknown page"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workspace</CardTitle>
            <CardDescription>{PLANS[org.plan].name} plan</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" /> Team seats
              </span>
              <span className="font-medium">
                {memberCount ?? 0} / {limits.agentSeats}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Bot className="h-4 w-4" /> Bots
              </span>
              <span className="font-medium">
                {botCount ?? 0} / {limits.bots}
              </span>
            </div>
            <Button asChild size="sm" className="mt-1 w-fit">
              <Link href="/dashboard/settings/billing">
                {org.plan === "free" ? "Upgrade plan" : "Manage plan"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
