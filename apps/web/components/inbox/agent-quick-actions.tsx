"use client";

import { useEffect, useState } from "react";
import { Zap, ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { Conversation } from "@velobot/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface AvailableAction {
  id: string;
  name: string;
  trigger_description: string;
  parameters: { name: string; type: "string" | "number" | "boolean"; required: boolean; description: string }[];
}

type RunState = { status: "idle" } | { status: "running" } | { status: "ok"; note: string } | { status: "error"; message: string };

/** Best-effort prefill: only the one field the conversation actually supplies data for — no fragile NLP extraction. */
function prefill(action: AvailableAction, conversation: Conversation): Record<string, string> {
  const values: Record<string, string> = {};
  for (const param of action.parameters) {
    if (param.name === "email" && conversation.visitor_email) values[param.name] = conversation.visitor_email;
    else values[param.name] = "";
  }
  return values;
}

export function AgentQuickActions({ conversation }: { conversation: Conversation }) {
  const [actions, setActions] = useState<AvailableAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [runStates, setRunStates] = useState<Record<string, RunState>>({});

  useEffect(() => {
    setLoading(true);
    setExpandedId(null);
    fetch(`/api/bots/${conversation.bot_id}/actions/available`)
      .then((res) => res.json())
      .then((body) => setActions(body.actions ?? []))
      .finally(() => setLoading(false));
  }, [conversation.bot_id]);

  function toggle(action: AvailableAction) {
    if (expandedId === action.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(action.id);
    setFormValues(prefill(action, conversation));
  }

  async function run(action: AvailableAction) {
    setRunStates((prev) => ({ ...prev, [action.id]: { status: "running" } }));
    const params: Record<string, string | number | boolean> = {};
    for (const param of action.parameters) {
      const raw = formValues[param.name] ?? "";
      if (param.type === "number") params[param.name] = raw === "" ? 0 : Number(raw);
      else if (param.type === "boolean") params[param.name] = raw === "true";
      else params[param.name] = raw;
    }

    const res = await fetch(`/api/conversations/${conversation.id}/actions/${action.id}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ params }),
    });
    const body = await res.json();
    setRunStates((prev) => ({
      ...prev,
      [action.id]: body.ok ? { status: "ok", note: `HTTP ${body.status}` } : { status: "error", message: body.error ?? "Failed" },
    }));
  }

  if (loading) return null;
  if (actions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        <Zap className="h-4 w-4" /> Quick actions
      </h2>
      <div className="flex flex-col gap-2">
        {actions.map((action) => {
          const expanded = expandedId === action.id;
          const state = runStates[action.id] ?? { status: "idle" as const };
          return (
            <div key={action.id} className="rounded-lg border">
              <button
                onClick={() => toggle(action)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium"
              >
                <span className="truncate">{action.name}</span>
                {expanded ? <ChevronUp className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
              </button>

              {expanded && (
                <div className="flex flex-col gap-2 border-t px-3 py-2.5">
                  {action.parameters.map((param) => (
                    <div key={param.name} className="flex flex-col gap-1">
                      <Label className="text-xs">
                        {param.name}
                        {param.required && <span className="text-status-critical"> *</span>}
                      </Label>
                      {param.type === "boolean" ? (
                        <Switch
                          checked={formValues[param.name] === "true"}
                          onCheckedChange={(checked) => setFormValues((v) => ({ ...v, [param.name]: checked ? "true" : "false" }))}
                        />
                      ) : (
                        <Input
                          className="h-8 text-sm"
                          type={param.type === "number" ? "number" : "text"}
                          placeholder={param.description}
                          value={formValues[param.name] ?? ""}
                          onChange={(e) => setFormValues((v) => ({ ...v, [param.name]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}

                  <Button size="sm" className="mt-1" onClick={() => run(action)} disabled={state.status === "running"}>
                    {state.status === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Execute action
                  </Button>

                  {state.status === "ok" && (
                    <p className="flex items-center gap-1 text-xs text-status-good">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Executed — {state.note}
                    </p>
                  )}
                  {state.status === "error" && (
                    <p className="flex items-center gap-1 text-xs text-status-critical">
                      <XCircle className="h-3.5 w-3.5" /> {state.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
