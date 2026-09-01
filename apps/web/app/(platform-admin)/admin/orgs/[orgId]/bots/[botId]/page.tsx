import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ChevronLeft } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Bot, KnowledgeSource, Conversation, SourceStatus, ConversationStatus } from "@velobot/shared";

const SOURCE_STATUS_VARIANT: Record<SourceStatus, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  pending: "secondary",
  crawling: "warning",
  processing: "warning",
  ready: "success",
  failed: "destructive",
};

const CONVERSATION_STATUS_VARIANT: Record<ConversationStatus, "default" | "success" | "warning" | "secondary"> = {
  ai: "secondary",
  queued: "warning",
  assigned: "default",
  resolved: "success",
};

export default async function AdminBotDetailPage({ params }: { params: { orgId: string; botId: string } }) {
  await requirePlatformAdmin();
  const admin = createSupabaseAdminClient();

  const { data: bot } = await admin.from("bots").select("*").eq("id", params.botId).eq("org_id", params.orgId).maybeSingle();
  if (!bot) notFound();
  const typedBot = bot as Bot;

  const [{ data: sources }, { data: conversations }] = await Promise.all([
    admin.from("knowledge_sources").select("*").eq("bot_id", params.botId).order("created_at", { ascending: false }),
    admin
      .from("conversations")
      .select("*")
      .eq("bot_id", params.botId)
      .order("last_message_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/admin/orgs/${params.orgId}`} className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to organization
      </Link>

      <Card>
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <span className="h-8 w-8 shrink-0 rounded-lg border" style={{ backgroundColor: typedBot.theme_color }} />
          <div>
            <CardTitle>{typedBot.name}</CardTitle>
            <CardDescription>{typedBot.description || "No description"}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between border-b py-2">
            <span className="text-muted-foreground">Welcome message</span>
            <span className="max-w-sm text-right">{typedBot.welcome_message}</span>
          </div>
          <div className="flex justify-between border-b py-2">
            <span className="text-muted-foreground">Allowed domains</span>
            <span>{typedBot.allowed_domains.length > 0 ? typedBot.allowed_domains.join(", ") : "Any"}</span>
          </div>
          <div className="flex justify-between border-b py-2">
            <span className="text-muted-foreground">Fallback email</span>
            <span>{typedBot.fallback_email_enabled ? "Enabled" : "Disabled"}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Created</span>
            <span>{format(new Date(typedBot.created_at), "PP")}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Knowledge sources</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y p-0">
            {((sources ?? []) as KnowledgeSource[]).map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-6 py-2 text-sm">
                <span className="truncate">{s.source_url || s.file_path || s.type}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {s.status === "ready" && <span className="text-xs text-muted-foreground">{s.pages_crawled} pages</span>}
                  <Badge variant={SOURCE_STATUS_VARIANT[s.status]} className="capitalize">
                    {s.status}
                  </Badge>
                </span>
              </div>
            ))}
            {(sources ?? []).length === 0 && <p className="px-6 py-4 text-sm text-muted-foreground">No knowledge sources.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent conversations</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y p-0">
            {((conversations ?? []) as Conversation[]).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-6 py-2 text-sm">
                <span className="truncate">{c.visitor_email || c.visitor_location || c.session_id.slice(0, 12)}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">{format(new Date(c.last_message_at), "PP")}</span>
                  <Badge variant={CONVERSATION_STATUS_VARIANT[c.status]} className="capitalize">
                    {c.status}
                  </Badge>
                </span>
              </div>
            ))}
            {(conversations ?? []).length === 0 && <p className="px-6 py-4 text-sm text-muted-foreground">No conversations yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
