"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, FlaskConical, Zap, UserPlus, Ticket, CalendarClock, Wrench } from "lucide-react";
import {
  ACTION_TEMPLATES,
  type ActionTemplate,
  type Connection,
  type BotAction,
  type ActionParameter,
  type ActionParamType,
} from "@velobot/shared";
import type { ActionWithBotIds } from "@/lib/actions/actions-manager";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ActionTester } from "@/components/dashboard/action-tester";

const TEMPLATE_ICON: Record<string, React.ElementType> = {
  lead_capture: UserPlus,
  ticket_lookup: Ticket,
  book_appointment: CalendarClock,
};

interface BotOption {
  id: string;
  name: string;
}

function emptyForm(connections: Connection[]) {
  return {
    name: "",
    connection_id: connections[0]?.id ?? "",
    method: "GET" as BotAction["method"],
    path: "",
    trigger_description: "",
    parameters: [] as ActionParameter[],
    is_active: true,
    bot_ids: [] as string[],
  };
}

type FormState = ReturnType<typeof emptyForm>;

export function ActionsTab({
  orgId,
  connections,
  bots,
  initialActions,
}: {
  orgId: string;
  connections: Connection[];
  bots: BotOption[];
  initialActions: ActionWithBotIds[];
}) {
  const [actions, setActions] = useState(initialActions);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(connections));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testingAction, setTestingAction] = useState<BotAction | null>(null);

  function connectionName(id: string) {
    return connections.find((c) => c.id === id)?.name ?? "Unknown connection";
  }

  function linkedBotNames(ids: string[]) {
    return ids.map((id) => bots.find((b) => b.id === id)?.name ?? "Unknown bot");
  }

  function openFromTemplate(template: ActionTemplate) {
    setEditingId(null);
    setForm({
      name: template.key,
      connection_id: connections[0]?.id ?? "",
      method: template.method,
      path: template.path,
      trigger_description: template.trigger_description,
      parameters: template.parameters,
      is_active: true,
      bot_ids: [],
    });
    setError(null);
    setPickerOpen(false);
    setFormOpen(true);
  }

  function openCustom() {
    setEditingId(null);
    setForm(emptyForm(connections));
    setError(null);
    setPickerOpen(false);
    setFormOpen(true);
  }

  function openEdit(action: ActionWithBotIds) {
    setEditingId(action.id);
    setForm({
      name: action.name,
      connection_id: action.connection_id,
      method: action.method,
      path: action.path,
      trigger_description: action.trigger_description,
      parameters: action.parameters,
      is_active: action.is_active,
      bot_ids: action.bot_ids,
    });
    setError(null);
    setFormOpen(true);
  }

  function toggleBotLink(botId: string) {
    setForm((f) => ({
      ...f,
      bot_ids: f.bot_ids.includes(botId) ? f.bot_ids.filter((id) => id !== botId) : [...f.bot_ids, botId],
    }));
  }

  function updateParam(index: number, patch: Partial<ActionParameter>) {
    setForm((f) => ({ ...f, parameters: f.parameters.map((p, i) => (i === index ? { ...p, ...patch } : p)) }));
  }

  function removeParam(index: number) {
    setForm((f) => ({ ...f, parameters: f.parameters.filter((_, i) => i !== index) }));
  }

  function addParam() {
    setForm((f) => ({
      ...f,
      parameters: [...f.parameters, { name: "", type: "string" as ActionParamType, required: false, description: "" }],
    }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const path = editingId ? `/api/orgs/${orgId}/actions/${editingId}` : `/api/orgs/${orgId}/actions`;
    const res = await fetch(path, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(typeof body.error === "string" ? body.error : "Failed to save action");
      return;
    }
    setActions((prev) => (editingId ? prev.map((a) => (a.id === editingId ? body.action : a)) : [body.action, ...prev]));
    setFormOpen(false);
  }

  async function remove(action: ActionWithBotIds) {
    if (!confirm(`Delete action "${action.name}"? Every bot it's linked to will lose access to it.`)) return;
    const res = await fetch(`/api/orgs/${orgId}/actions/${action.id}`, { method: "DELETE" });
    if (res.ok) setActions((prev) => prev.filter((a) => a.id !== action.id));
  }

  async function toggleActive(action: ActionWithBotIds) {
    const res = await fetch(`/api/orgs/${orgId}/actions/${action.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !action.is_active }),
    });
    const body = await res.json();
    if (res.ok) setActions((prev) => prev.map((a) => (a.id === action.id ? body.action : a)));
  }

  const liveCount = actions.filter((a) => a.is_active).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {actions.length} {actions.length === 1 ? "action" : "actions"} · {liveCount} live
        </p>
        <Button onClick={() => setPickerOpen(true)}>
          <Plus className="h-4 w-4" /> New action
        </Button>
      </div>

      {connections.length === 0 && (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          You haven&apos;t set up any Connections yet — add one in{" "}
          <a href="/dashboard/settings/connections" className="font-medium text-primary underline-offset-2 hover:underline">
            Connections
          </a>{" "}
          before creating an action.
        </p>
      )}

      {actions.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium">No actions configured yet</p>
              <p className="text-sm text-muted-foreground">Start from a template or build a custom one.</p>
            </div>
            <Button className="mt-2" onClick={() => setPickerOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> New action
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {actions.map((action) => {
            const linkedBots = linkedBotNames(action.bot_ids);
            return (
              <Card key={action.id}>
                <CardContent className="flex flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Zap className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold leading-tight">{action.name}</p>
                          <Badge variant={action.is_active ? "success" : "secondary"}>
                            {action.is_active ? "Live" : "Draft"}
                          </Badge>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          <span className="font-mono">
                            {action.method} {action.path}
                          </span>{" "}
                          · {connectionName(action.connection_id)}
                        </p>
                      </div>
                    </div>
                    <Switch checked={action.is_active} onCheckedChange={() => toggleActive(action)} />
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 border-t pt-3.5">
                    <span className="mr-1 text-xs text-muted-foreground">Linked bots:</span>
                    {linkedBots.length === 0 ? (
                      <span className="text-xs text-muted-foreground">None yet</span>
                    ) : (
                      linkedBots.map((name) => (
                        <Badge key={name} variant="secondary" className="font-normal">
                          {name}
                        </Badge>
                      ))
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t pt-3.5">
                    <Button variant="outline" size="sm" onClick={() => setTestingAction(action)}>
                      <FlaskConical className="h-3.5 w-3.5" /> Test
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(action)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-muted-foreground hover:text-status-critical"
                      onClick={() => remove(action)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Template picker */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New action</DialogTitle>
            <DialogDescription>Start from a template or build a custom action.</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-3 sm:grid-cols-3">
            {ACTION_TEMPLATES.map((template) => {
              const Icon = TEMPLATE_ICON[template.key] ?? Zap;
              return (
                <Card key={template.key} className="cursor-pointer transition-colors hover:border-primary" onClick={() => openFromTemplate(template)}>
                  <CardHeader className="pb-2">
                    <Icon className="mb-1 h-5 w-5 text-primary" />
                    <CardTitle className="text-sm">{template.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-xs">{template.description}</CardDescription>
                  </CardContent>
                </Card>
              );
            })}
            <Card className="cursor-pointer transition-colors hover:border-primary" onClick={openCustom}>
              <CardHeader className="pb-2">
                <Wrench className="mb-1 h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-sm">Custom action</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">Define your own method, path, and parameters.</CardDescription>
              </CardContent>
            </Card>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Config form */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit action" : "Configure action"}</DialogTitle>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="action-name">Action name</Label>
                <Input
                  id="action-name"
                  placeholder="lead_create"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Linked connection</Label>
                <Select value={form.connection_id} onValueChange={(v) => setForm((f) => ({ ...f, connection_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a connection" />
                  </SelectTrigger>
                  <SelectContent>
                    {connections.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-[120px_1fr] gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Method</Label>
                <Select value={form.method} onValueChange={(v) => setForm((f) => ({ ...f, method: v as BotAction["method"] }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="action-path">Endpoint path</Label>
                <Input
                  id="action-path"
                  placeholder="/tickets/{ticket_id}"
                  value={form.path}
                  onChange={(e) => setForm((f) => ({ ...f, path: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="action-trigger">Trigger description (for the LLM)</Label>
              <Textarea
                id="action-trigger"
                placeholder="Trigger when the user asks about the status of a support ticket or order number."
                rows={2}
                value={form.trigger_description}
                onChange={(e) => setForm((f) => ({ ...f, trigger_description: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Parameters</Label>
              {form.parameters.map((param, i) => (
                <div key={i} className="grid grid-cols-[1.2fr_100px_auto_1.5fr_auto] items-center gap-2">
                  <Input placeholder="ticket_id" value={param.name} onChange={(e) => updateParam(i, { name: e.target.value })} />
                  <Select value={param.type} onValueChange={(v) => updateParam(i, { type: v as ActionParamType })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">string</SelectItem>
                      <SelectItem value="number">number</SelectItem>
                      <SelectItem value="boolean">boolean</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Switch checked={param.required} onCheckedChange={(v) => updateParam(i, { required: v })} /> Required
                  </div>
                  <Input
                    placeholder="Extraction hint for the LLM"
                    value={param.description}
                    onChange={(e) => updateParam(i, { description: e.target.value })}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeParam(i)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addParam}>
                <Plus className="h-3.5 w-3.5" /> Add parameter
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Linked bots</Label>
              {bots.length === 0 ? (
                <p className="text-xs text-muted-foreground">Create a bot first, then come back to link it here.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {bots.map((bot) => {
                    const linked = form.bot_ids.includes(bot.id);
                    return (
                      <button
                        key={bot.id}
                        type="button"
                        onClick={() => toggleBotLink(bot.id)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          linked ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        {bot.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">{form.is_active ? "Live" : "Draft"}</p>
                <p className="text-xs text-muted-foreground">Draft actions aren&apos;t offered to the AI or agents.</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(is_active) => setForm((f) => ({ ...f, is_active }))} />
            </div>

            {error && <p className="text-sm text-status-critical">{error}</p>}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !form.name || !form.connection_id || !form.path || !form.trigger_description}>
              {saving ? "Saving..." : "Save action"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {testingAction && <ActionTester orgId={orgId} action={testingAction} onClose={() => setTestingAction(null)} />}
    </div>
  );
}
