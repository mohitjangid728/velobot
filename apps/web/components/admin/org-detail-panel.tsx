"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLAN_TIERS, PLANS, type Organization, type Plan } from "@velobot/shared";

export function OrgDetailPanel({ org, canManage }: { org: Organization; canManage: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(org.name);
  const [slug, setSlug] = useState(org.slug);
  const [plan, setPlan] = useState<Plan>(org.plan);
  const [seatsLimit, setSeatsLimit] = useState(org.seats_limit);
  const [addonMessageBalance, setAddonMessageBalance] = useState(org.addon_message_balance);
  const [addonSeats, setAddonSeats] = useState(org.addon_seats);
  const [saving, setSaving] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/orgs/${org.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        slug,
        plan,
        seats_limit: seatsLimit,
        addon_message_balance: addonMessageBalance,
        addon_seats: addonSeats,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to save");
      return;
    }
    router.refresh();
  }

  async function toggleSuspend() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/orgs/${org.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended: !org.suspended_at }),
    });
    setSaving(false);
    if (res.ok) router.refresh();
  }

  async function impersonate() {
    setImpersonating(true);
    const res = await fetch(`/api/admin/orgs/${org.id}/impersonate`, { method: "POST" });
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setImpersonating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              {org.name}
              {!canManage && (
                <Badge variant="outline" className="font-normal">
                  View only
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{org.slug}</CardDescription>
          </div>
          {canManage && (
            <Button onClick={impersonate} disabled={impersonating}>
              {impersonating ? "Entering..." : "Impersonate"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 sm:max-w-lg">
            <div className="flex flex-col gap-1.5">
              <Label>Workspace name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Slug</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} disabled={!canManage} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Plan</Label>
              <Select value={plan} onValueChange={(v) => setPlan(v as Plan)} disabled={!canManage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_TIERS.map((tier) => (
                    <SelectItem key={tier} value={tier}>
                      {PLANS[tier].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Seats limit</Label>
              <Input
                type="number"
                min={1}
                value={seatsLimit}
                onChange={(e) => setSeatsLimit(parseInt(e.target.value, 10) || 1)}
                disabled={!canManage}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Bonus message balance</Label>
              <Input
                type="number"
                min={0}
                value={addonMessageBalance}
                onChange={(e) => setAddonMessageBalance(parseInt(e.target.value, 10) || 0)}
                disabled={!canManage}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Extra seats (add-on)</Label>
              <Input
                type="number"
                min={0}
                value={addonSeats}
                onChange={(e) => setAddonSeats(parseInt(e.target.value, 10) || 0)}
                disabled={!canManage}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {canManage && (
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </Button>
              <Button size="sm" variant={org.suspended_at ? "outline" : "destructive"} onClick={toggleSuspend} disabled={saving}>
                {org.suspended_at ? "Reactivate workspace" : "Suspend workspace"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
