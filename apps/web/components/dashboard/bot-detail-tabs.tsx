"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Bot, KnowledgeSource, Queue, WorkflowRule } from "@velobot/shared";
import type { WorkflowRuleHitStats } from "@/lib/workflow/workflow-manager";
import { SourcesPanel } from "@/components/dashboard/sources-panel";
import { BotSettingsPanel } from "@/components/dashboard/bot-settings-panel";
import { BotGuardrailsPanel } from "@/components/dashboard/bot-guardrails-panel";
import { BotLlmPanel } from "@/components/dashboard/bot-llm-panel";
import { BotDataExtractionPanel } from "@/components/dashboard/bot-data-extraction-panel";
import { BotWorkflowPanel } from "@/components/dashboard/bot-workflow-panel";
import { EmbedPanel } from "@/components/dashboard/embed-panel";
import { BotTestChat } from "@/components/dashboard/bot-test-chat";

/** Underline style — plain text, a colored bottom border marks the active tab. Overridden here rather than in the shared primitive since this is the only place that currently uses Tabs. */
const TAB_TRIGGER_CLASS =
  "shrink-0 rounded-none border-b-2 border-transparent px-0.5 py-3 text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none";

export function BotDetailTabs({
  bot,
  sources,
  queues,
  pagesUsed,
  pagesLimit,
  workflowRules,
  workflowHitStats,
  hasRemoveBranding,
}: {
  bot: Bot;
  sources: KnowledgeSource[];
  queues: Queue[];
  pagesUsed: number;
  pagesLimit: number;
  workflowRules: WorkflowRule[];
  workflowHitStats: Record<string, WorkflowRuleHitStats>;
  hasRemoveBranding: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(bot);

  function handleUpdated(updated: Bot) {
    setCurrent(updated);
    router.refresh();
  }

  return (
    <Tabs defaultValue="sources" className="w-full">
      {/*
        `top: -2rem` (not -mt-8/pt-8 — that inflated the box itself and
        made it overlap the header above it) cancels out <main>'s own top
        padding for the STUCK position only: a sticky element's resting
        position is pure normal flow and ignores `top` entirely, so this
        offset has zero effect until scrolling would engage it — it only
        ever changes where it clamps once stuck, from 32px down (main's
        p-8) to flush against the viewport edge.
      */}
      <TabsList className="sticky -top-8 z-10 -mx-8 h-auto w-[calc(100%+4rem)] max-w-none justify-start gap-6 overflow-x-auto rounded-none border-b bg-background px-8 py-0">
        <TabsTrigger value="sources" className={TAB_TRIGGER_CLASS}>
          Knowledge sources
        </TabsTrigger>
        <TabsTrigger value="test" className={TAB_TRIGGER_CLASS}>
          Test bot
        </TabsTrigger>
        <TabsTrigger value="guardrails" className={TAB_TRIGGER_CLASS}>
          Guardrails
        </TabsTrigger>
        <TabsTrigger value="llm" className={TAB_TRIGGER_CLASS}>
          AI model
        </TabsTrigger>
        <TabsTrigger value="extraction" className={TAB_TRIGGER_CLASS}>
          Data extraction
        </TabsTrigger>
        <TabsTrigger value="workflow" className={TAB_TRIGGER_CLASS}>
          Workflow
        </TabsTrigger>
        <TabsTrigger value="settings" className={TAB_TRIGGER_CLASS}>
          Settings
        </TabsTrigger>
        <TabsTrigger value="embed" className={TAB_TRIGGER_CLASS}>
          Embed
        </TabsTrigger>
      </TabsList>
      <TabsContent value="sources">
        <SourcesPanel bot={current} initialSources={sources} pagesUsed={pagesUsed} pagesLimit={pagesLimit} />
      </TabsContent>
      <TabsContent value="test">
        <BotTestChat bot={current} />
      </TabsContent>
      <TabsContent value="guardrails">
        <BotGuardrailsPanel bot={current} onUpdated={handleUpdated} />
      </TabsContent>
      <TabsContent value="llm">
        <BotLlmPanel bot={current} onUpdated={handleUpdated} />
      </TabsContent>
      <TabsContent value="extraction">
        <BotDataExtractionPanel bot={current} onUpdated={handleUpdated} />
      </TabsContent>
      <TabsContent value="workflow">
        <BotWorkflowPanel botId={current.id} initialRules={workflowRules} hitStats={workflowHitStats} />
      </TabsContent>
      <TabsContent value="settings">
        <BotSettingsPanel bot={current} queues={queues} hasRemoveBranding={hasRemoveBranding} onUpdated={handleUpdated} />
      </TabsContent>
      <TabsContent value="embed">
        <EmbedPanel bot={current} />
      </TabsContent>
    </Tabs>
  );
}
