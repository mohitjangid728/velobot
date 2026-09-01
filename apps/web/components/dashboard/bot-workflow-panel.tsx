"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WorkflowActionType, WorkflowRule } from "@velobot/shared";
import type { WorkflowRuleHitStats } from "@/lib/workflow/workflow-manager";

function hitStatsLabel(stats: WorkflowRuleHitStats | undefined): string {
  if (!stats || !stats.lastFiredAt) return "Never fired yet";
  return `Fired ${stats.count} time${stats.count === 1 ? "" : "s"} · last ${formatDistanceToNow(new Date(stats.lastFiredAt), { addSuffix: true })}`;
}

export function BotWorkflowPanel({
  botId,
  initialRules,
  hitStats,
}: {
  botId: string;
  initialRules: WorkflowRule[];
  hitStats: Record<string, WorkflowRuleHitStats>;
}) {
  const [rules, setRules] = useState(initialRules);
  const [name, setName] = useState("");
  const [triggerValue, setTriggerValue] = useState("");
  const [actionType, setActionType] = useState<WorkflowActionType>("canned_reply");
  const [actionValue, setActionValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const res = await fetch(`/api/bots/${botId}/workflow-rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        trigger_type: "keyword",
        trigger_value: triggerValue,
        action_type: actionType,
        action_value: actionValue || null,
        enabled: true,
        position: rules.length,
      }),
    });
    const body = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(body.error?.formErrors?.join(", ") ?? body.error ?? "Failed to create rule");
      return;
    }
    setRules((prev) => [...prev, body.rule]);
    setName("");
    setTriggerValue("");
    setActionValue("");
  }

  async function toggleRule(rule: WorkflowRule) {
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)));
    await fetch(`/api/bots/${botId}/workflow-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
  }

  async function deleteRule(ruleId: string) {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    await fetch(`/api/bots/${botId}/workflow-rules/${ruleId}`, { method: "DELETE" });
  }

  return (
    <div className="mt-4 flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4" /> Workflow rules
          </CardTitle>
          <CardDescription>
            Deterministic if/then rules that run before the AI sees a message — for cases you don&apos;t want left to the model&apos;s
            judgment. The first enabled rule whose keywords match wins.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y p-0">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-start justify-between gap-4 p-4">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{rule.name}</p>
                  <Badge variant={rule.action_type === "escalate" ? "warning" : "outline"} className="capitalize">
                    {rule.action_type === "escalate" ? "Escalate" : "Canned reply"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  If message contains: <span className="font-mono">{rule.trigger_value}</span>
                </p>
                {rule.action_value && <p className="truncate text-xs text-muted-foreground">→ &ldquo;{rule.action_value}&rdquo;</p>}
                <p className="text-xs text-muted-foreground">{hitStatsLabel(hitStats[rule.id])}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Switch checked={rule.enabled} onCheckedChange={() => toggleRule(rule)} />
                <Button variant="ghost" size="icon" onClick={() => deleteRule(rule.id)} aria-label="Delete rule">
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {rules.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">No workflow rules yet — add one below.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a rule</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createRule} className="flex max-w-lg flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rule-name">Name</Label>
              <Input id="rule-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Refund requests" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rule-trigger">Trigger keywords</Label>
              <Input
                id="rule-trigger"
                required
                value={triggerValue}
                onChange={(e) => setTriggerValue(e.target.value)}
                placeholder="refund, cancel subscription, chargeback"
              />
              <p className="text-xs text-muted-foreground">Comma-separated. Matches as a substring, case-insensitive.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rule-action">Action</Label>
              <Select value={actionType} onValueChange={(v) => setActionType(v as WorkflowActionType)}>
                <SelectTrigger id="rule-action">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="canned_reply">Reply with a fixed message (skips the AI)</SelectItem>
                  <SelectItem value="escalate">Escalate to a human agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rule-value">{actionType === "escalate" ? "Message before escalating (optional)" : "Reply text"}</Label>
              <Textarea
                id="rule-value"
                required={actionType === "canned_reply"}
                value={actionValue}
                onChange={(e) => setActionValue(e.target.value)}
                placeholder={
                  actionType === "escalate"
                    ? "I'll connect you with someone from our team right away."
                    : "I'm sorry to hear that! Our refund policy allows returns within 30 days — I've flagged this for our team to follow up."
                }
                rows={2}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={creating} className="w-fit">
              {creating ? "Adding..." : "Add rule"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
