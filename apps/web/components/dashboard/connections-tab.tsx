"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Plug, Plus, Pencil, Trash2, Radio, ScrollText, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { Connection, ConnectionAuthType, ConnectionAuthConfig, ConnectionLog } from "@velobot/shared";
import { ConnectionAuthFields, AUTH_TYPE_LABELS } from "@/components/dashboard/connection-auth-fields";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { KeyValueEditor, type KeyValueRow } from "@/components/dashboard/key-value-editor";
import { cn } from "@/lib/utils";

type PingState = { status: "idle" } | { status: "loading" } | { status: "ok"; latencyMs: number } | { status: "error"; message: string };

interface ConnectionFormState {
  name: string;
  base_url: string;
  headers: KeyValueRow[];
  auth_type: ConnectionAuthType;
  auth_config: ConnectionAuthConfig;
  is_active: boolean;
}

function emptyForm(): ConnectionFormState {
  return { name: "", base_url: "", headers: [], auth_type: "custom_headers", auth_config: { type: "custom_headers" }, is_active: true };
}

export function ConnectionsTab({ orgId, initialConnections }: { orgId: string; initialConnections: Connection[] }) {
  const [connections, setConnections] = useState(initialConnections);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pingState, setPingState] = useState<Record<string, PingState>>({});
  const [logsConnection, setLogsConnection] = useState<Connection | null>(null);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
    setFormOpen(true);
  }

  async function openEdit(connection: Connection) {
    setEditingId(connection.id);
    setError(null);
    setFormOpen(true);
    // Re-fetch unmasked — the list response has header values redacted.
    const res = await fetch(`/api/orgs/${orgId}/connections/${connection.id}`);
    const body = await res.json();
    if (res.ok) {
      const c = body.connection as Connection;
      setForm({
        name: c.name,
        base_url: c.base_url,
        headers: c.headers,
        // Rows created before ConnectionAuthType existed have neither field set.
        auth_type: c.auth_type ?? "custom_headers",
        auth_config: c.auth_config ?? { type: "custom_headers" },
        is_active: c.is_active,
      });
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    const path = editingId ? `/api/orgs/${orgId}/connections/${editingId}` : `/api/orgs/${orgId}/connections`;
    const res = await fetch(path, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, headers: form.headers.filter((h) => h.key.trim() && h.value.trim()) }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(typeof body.error === "string" ? body.error : "Failed to save connection");
      return;
    }
    setConnections((prev) => {
      if (editingId) return prev.map((c) => (c.id === editingId ? body.connection : c));
      return [body.connection, ...prev];
    });
    setFormOpen(false);
  }

  async function remove(connection: Connection) {
    if (!confirm(`Delete connection "${connection.name}"? Any actions linked to it will stop working.`)) return;
    const res = await fetch(`/api/orgs/${orgId}/connections/${connection.id}`, { method: "DELETE" });
    if (res.ok) setConnections((prev) => prev.filter((c) => c.id !== connection.id));
  }

  async function ping(connection: Connection) {
    setPingState((prev) => ({ ...prev, [connection.id]: { status: "loading" } }));
    const res = await fetch(`/api/orgs/${orgId}/connections/${connection.id}/ping`, { method: "POST" });
    const body = await res.json();
    setPingState((prev) => ({
      ...prev,
      [connection.id]: body.ok ? { status: "ok", latencyMs: body.latencyMs } : { status: "error", message: body.error ?? "Failed" },
    }));
  }

  const liveCount = connections.filter((c) => c.is_active).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {connections.length} {connections.length === 1 ? "connection" : "connections"} · {liveCount} live
        </p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New connection
        </Button>
      </div>

      {connections.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Plug className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium">No connections yet</p>
              <p className="text-sm text-muted-foreground">Add one to start building Bot Actions on top of it.</p>
            </div>
            <Button className="mt-2" onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" /> New connection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {connections.map((connection) => {
            const ping_ = pingState[connection.id] ?? { status: "idle" };
            return (
              <Card key={connection.id}>
                <CardContent className="flex flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Plug className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold leading-tight">{connection.name}</p>
                          <Badge variant={connection.is_active ? "success" : "secondary"}>
                            {connection.is_active ? "Live" : "Draft"}
                          </Badge>
                          <Badge variant="outline">{AUTH_TYPE_LABELS[connection.auth_type ?? "custom_headers"]}</Badge>
                        </div>
                        <p className="truncate font-mono text-xs text-muted-foreground">{connection.base_url}</p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 text-xs">
                      {ping_.status === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                      {ping_.status === "ok" && (
                        <span className="flex items-center gap-1 rounded-full bg-status-good-bg px-2 py-1 font-medium text-status-good">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {ping_.latencyMs}ms
                        </span>
                      )}
                      {ping_.status === "error" && (
                        <span
                          className="flex max-w-[180px] items-center gap-1 truncate rounded-full bg-status-critical-bg px-2 py-1 font-medium text-status-critical"
                          title={ping_.message}
                        >
                          <XCircle className="h-3.5 w-3.5" /> {ping_.message}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t pt-3.5">
                    <Button variant="outline" size="sm" onClick={() => ping(connection)}>
                      <Radio className="h-3.5 w-3.5" /> Test
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setLogsConnection(connection)}>
                      <ScrollText className="h-3.5 w-3.5" /> Delivery logs
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(connection)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-muted-foreground hover:text-status-critical"
                      onClick={() => remove(connection)}
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit connection" : "New connection"}</DialogTitle>
            <DialogDescription>Base URL and credentials shared by every Bot Action linked to it.</DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="conn-name">Name</Label>
              <Input
                id="conn-name"
                placeholder="Production Helpdesk API"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="conn-url">Base URL</Label>
              <Input
                id="conn-url"
                placeholder="https://api.example.com/v1"
                value={form.base_url}
                onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
              />
            </div>
            <ConnectionAuthFields
              authType={form.auth_type}
              authConfig={form.auth_config}
              onAuthTypeChange={(auth_type) => setForm((f) => ({ ...f, auth_type }))}
              onAuthConfigChange={(auth_config) => setForm((f) => ({ ...f, auth_config }))}
            />
            <div className="flex flex-col gap-1.5">
              <Label>Additional headers (optional)</Label>
              <KeyValueEditor
                rows={form.headers}
                onChange={(headers) => setForm((f) => ({ ...f, headers }))}
                keyPlaceholder="x-tenant-id"
                valuePlaceholder="acme-corp"
                addLabel="Add header"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">{form.is_active ? "Live" : "Draft"}</p>
                <p className="text-xs text-muted-foreground">Draft connections are hidden from the AI and agents.</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(is_active) => setForm((f) => ({ ...f, is_active }))} />
            </div>
            {error && <p className="text-sm text-status-critical">{error}</p>}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !form.name || !form.base_url}>
              {saving ? "Saving..." : "Save connection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {logsConnection && (
        <ConnectionLogsSheet orgId={orgId} connection={logsConnection} onClose={() => setLogsConnection(null)} />
      )}
    </div>
  );
}

function ConnectionLogsSheet({ orgId, connection, onClose }: { orgId: string; connection: Connection; onClose: () => void }) {
  const [logs, setLogs] = useState<ConnectionLog[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/orgs/${orgId}/connections/${connection.id}/logs`)
      .then((res) => res.json())
      .then((body) => {
        setLogs(body.logs ?? []);
        setNextCursor(body.nextCursor ?? null);
        setLoading(false);
      });
  }, [orgId, connection.id]);

  async function loadMore() {
    if (!nextCursor) return;
    const res = await fetch(`/api/orgs/${orgId}/connections/${connection.id}/logs?cursor=${encodeURIComponent(nextCursor)}`);
    const body = await res.json();
    setLogs((prev) => [...prev, ...(body.logs ?? [])]);
    setNextCursor(body.nextCursor ?? null);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="inset-y-0 left-auto right-0 top-0 h-full max-h-screen w-full max-w-md translate-x-0 translate-y-0 rounded-none border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:rounded-none">
        <DialogHeader>
          <DialogTitle>Delivery logs</DialogTitle>
          <DialogDescription>{connection.name}</DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No requests logged yet.</p>
        ) : (
          <>
            {logs.map((log) => {
              const ok = log.response_status !== null && log.response_status < 400 && !log.error_message;
              return (
                <button
                  key={log.id}
                  onClick={() => setExpandedId((id) => (id === log.id ? null : log.id))}
                  className="flex flex-col gap-1 rounded-lg border px-3 py-2 text-left text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-mono">
                      <Badge variant={ok ? "success" : "serious"} className="px-1.5 py-0 text-[10px]">
                        {log.response_status ?? "ERR"}
                      </Badge>
                      {log.request_method} {log.request_path}
                    </span>
                    <span className="shrink-0 text-muted-foreground">{log.latency_ms}ms</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="uppercase tracking-wide">{log.source}</span>
                    <span>{format(new Date(log.created_at), "MMM d, p")}</span>
                  </div>
                  {expandedId === log.id && (
                    <pre className={cn("mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-[11px]")}>
                      {log.error_message ?? JSON.stringify(log.response_body ?? log.request_body, null, 2)}
                    </pre>
                  )}
                </button>
              );
            })}
            {nextCursor && (
              <Button variant="outline" size="sm" onClick={loadMore}>
                Load more
              </Button>
            )}
          </>
        )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
