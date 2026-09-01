"use client";

import { useState } from "react";
import { format } from "date-fns";
import { KeyRound, Trash2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog";

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export function ApiKeysPanel({ orgId, initialKeys, hasApiAccess }: { orgId: string; initialKeys: ApiKeyRow[]; hasApiAccess: boolean }) {
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const res = await fetch(`/api/orgs/${orgId}/api-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const body = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(body.error?.formErrors?.join(", ") ?? body.error ?? "Failed to create key");
      return;
    }
    const { secret, ...row } = body.key;
    setKeys((prev) => [row, ...prev]);
    setNewSecret(secret);
    setName("");
  }

  async function revokeKey(keyId: string) {
    setKeys((prev) => prev.map((k) => (k.id === keyId ? { ...k, revoked_at: new Date().toISOString() } : k)));
    await fetch(`/api/orgs/${orgId}/api-keys/${keyId}`, { method: "DELETE" });
  }

  function copySecret() {
    if (!newSecret) return;
    navigator.clipboard.writeText(newSecret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!hasApiAccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Developer API
          </CardTitle>
          <CardDescription>Read your bots and conversations from your own systems via a REST API.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            API access is a Business-plan feature. Upgrade from{" "}
            <a href="/dashboard/settings/billing" className="text-primary underline">
              Billing
            </a>{" "}
            to create keys.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Developer API keys
          </CardTitle>
          <CardDescription>
            Read-only access to your bots and conversations. See <span className="font-mono">docs/API.md</span> for endpoints — send
            each key as <span className="font-mono">Authorization: Bearer &lt;key&gt;</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y p-0">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center justify-between gap-4 p-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{k.name}</p>
                  {k.revoked_at && <Badge variant="secondary">Revoked</Badge>}
                </div>
                <p className="font-mono text-xs text-muted-foreground">
                  vb_live_{k.key_prefix}••••••••••••••••••••••••••••••••
                </p>
                <p className="text-xs text-muted-foreground">
                  Created {format(new Date(k.created_at), "PP")}
                  {k.last_used_at ? ` · Last used ${format(new Date(k.last_used_at), "PP")}` : " · Never used"}
                </p>
              </div>
              {!k.revoked_at && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => revokeKey(k.id)}
                  aria-label="Revoke key"
                  className="shrink-0 text-muted-foreground hover:text-status-critical"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {keys.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">No API keys yet — create one below.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create a key</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createKey} className="flex max-w-md items-end gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="key-name">Name</Label>
              <Input id="key-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Zapier integration" />
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? "Creating..." : "Create key"}
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-status-critical">{error}</p>}
        </CardContent>
      </Card>

      <Dialog open={!!newSecret} onOpenChange={(open) => !open && setNewSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your new API key</DialogTitle>
            <DialogDescription>Copy it now — for your security, this is the only time it&apos;s shown in full.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex items-center gap-2 rounded-md border bg-muted p-3">
              <code className="flex-1 truncate text-sm">{newSecret}</code>
              <Button variant="ghost" size="icon" onClick={copySecret} aria-label="Copy key">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setNewSecret(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
