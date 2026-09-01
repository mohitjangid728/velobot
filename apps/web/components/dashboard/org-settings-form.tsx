"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PLANS } from "@velobot/shared";
import type { Organization } from "@velobot/shared";

export function OrgSettingsForm({ org }: { org: Organization }) {
  const router = useRouter();
  const [name, setName] = useState(org.name);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/orgs/${org.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to save");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function deleteOrg() {
    if (!confirm(`Delete "${org.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/orgs/${org.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      router.push("/onboarding");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle>{org.name}</CardTitle>
                <Badge variant="secondary">{PLANS[org.plan].name} plan</Badge>
              </div>
              <CardDescription>Workspace slug: {org.slug}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="flex max-w-sm flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Workspace name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {error && <p className="text-sm text-status-critical">{error}</p>}
            {saved && <p className="text-sm text-status-good">Saved.</p>}
            <Button type="submit" disabled={saving} className="w-fit">
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-status-critical/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-status-critical">
            <AlertTriangle className="h-4 w-4" /> Danger zone
          </CardTitle>
          <CardDescription>Permanently delete this workspace and all its bots, conversations, and knowledge sources.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={deleteOrg} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete workspace"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
