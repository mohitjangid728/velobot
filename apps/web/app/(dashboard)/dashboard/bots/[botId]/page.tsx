import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot as BotIcon, Globe } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BotDetailTabs } from "@/components/dashboard/bot-detail-tabs";
import { Badge } from "@/components/ui/badge";
import { getPagesIndexed } from "@/lib/billing/usage";
import { listWorkflowRules, getWorkflowRuleHitStats } from "@/lib/workflow/workflow-manager";
import { getEffectivePlan } from "@velobot/shared";
import { getPlanOverride } from "@/lib/billing/plan-overrides";
import type { Bot, KnowledgeSource, Queue } from "@velobot/shared";

export default async function BotDetailPage({ params }: { params: { botId: string } }) {
  const { org } = await requireRole("admin");
  const supabase = createSupabaseServerClient();

  const { data: bot } = await supabase.from("bots").select("*").eq("id", params.botId).eq("org_id", org.id).maybeSingle();
  if (!bot) notFound();

  const [{ data: sources }, { data: queues }, pagesUsed, workflowRules, workflowHitStats] = await Promise.all([
    supabase.from("knowledge_sources").select("*").eq("bot_id", params.botId).order("created_at", { ascending: false }),
    supabase.from("queues").select("*").eq("org_id", org.id).order("created_at", { ascending: true }),
    getPagesIndexed(org.id),
    listWorkflowRules(params.botId),
    getWorkflowRuleHitStats(params.botId),
  ]);
  const effectivePlan = getEffectivePlan(org.plan, await getPlanOverride(org.plan));
  const pagesLimit = effectivePlan.quota.pages;

  const typedBot = bot as Bot;
  const queueName = (queues ?? []).find((q) => q.id === typedBot.queue_id)?.name;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/dashboard/bots" className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to bots
      </Link>

      <div className="flex items-start gap-4">
        {typedBot.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={typedBot.avatar_url} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover shadow-sm" />
        ) : (
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ backgroundColor: typedBot.theme_color }}
          >
            <BotIcon className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{typedBot.name}</h1>
            <Badge variant={typedBot.allowed_domains.length > 0 ? "success" : "warning"}>
              {typedBot.allowed_domains.length > 0 ? "Embeddable" : "No domains yet"}
            </Badge>
            {queueName && <Badge variant="outline">{queueName} queue</Badge>}
          </div>
          {typedBot.description && <p className="mt-1 text-sm text-muted-foreground">{typedBot.description}</p>}
          {typedBot.allowed_domains.length > 0 && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Globe className="h-3 w-3" /> {typedBot.allowed_domains.join(", ")}
            </p>
          )}
        </div>
      </div>

      <BotDetailTabs
        bot={typedBot}
        sources={(sources ?? []) as KnowledgeSource[]}
        queues={(queues ?? []) as Queue[]}
        pagesUsed={pagesUsed}
        pagesLimit={pagesLimit}
        workflowRules={workflowRules}
        workflowHitStats={Object.fromEntries(workflowHitStats)}
        hasRemoveBranding={effectivePlan.capabilities.removeBranding}
      />
    </div>
  );
}
