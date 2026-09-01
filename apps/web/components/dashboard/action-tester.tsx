"use client";

import { useState } from "react";
import type { BotAction } from "@velobot/shared";

type ActionParamValue = string | number | boolean;
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

function defaultParams(action: BotAction): Record<string, string> {
  return Object.fromEntries(action.parameters.map((p) => [p.name, ""]));
}

export function ActionTester({ orgId, action, onClose }: { orgId: string; action: BotAction; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(defaultParams(action));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; status: number | null; body: unknown; error?: string } | null>(null);

  async function run() {
    setRunning(true);
    setResult(null);
    const params: Record<string, ActionParamValue> = {};
    for (const param of action.parameters) {
      const raw = values[param.name] ?? "";
      if (param.type === "number") params[param.name] = raw === "" ? 0 : Number(raw);
      else if (param.type === "boolean") params[param.name] = raw === "true";
      else params[param.name] = raw;
    }

    const res = await fetch(`/api/orgs/${orgId}/actions/${action.id}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ params }),
    });
    const body = await res.json();
    setRunning(false);
    setResult(body);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Test &quot;{action.name}&quot;</DialogTitle>
          <DialogDescription>
            <span className="font-mono">
              {action.method} {action.path}
            </span>
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-3">
          {action.parameters.length === 0 ? (
            <p className="text-sm text-muted-foreground">This action has no parameters.</p>
          ) : (
            action.parameters.map((param) => (
              <div key={param.name} className="flex flex-col gap-1.5">
                <Label>
                  {param.name}
                  {param.required && <span className="text-status-critical"> *</span>}
                </Label>
                {param.type === "boolean" ? (
                  <Switch
                    checked={values[param.name] === "true"}
                    onCheckedChange={(checked) => setValues((v) => ({ ...v, [param.name]: checked ? "true" : "false" }))}
                  />
                ) : (
                  <Input
                    type={param.type === "number" ? "number" : "text"}
                    placeholder={param.description}
                    value={values[param.name] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [param.name]: e.target.value }))}
                  />
                )}
              </div>
            ))
          )}

          {result && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">
                {result.ok ? `Success — HTTP ${result.status}` : `Failed${result.status ? ` — HTTP ${result.status}` : ""}: ${result.error ?? ""}`}
              </p>
              <pre className="max-h-64 overflow-auto rounded-md border bg-muted p-3 text-xs">
                {JSON.stringify(result.body, null, 2)}
              </pre>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={run} disabled={running}>
            {running ? "Running..." : "Run"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
