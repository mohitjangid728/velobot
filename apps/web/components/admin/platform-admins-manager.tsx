"use client";

import { useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { PlatformAdmin, PlatformAdminRole } from "@velobot/shared";

type AdminWithEmail = PlatformAdmin & { email: string };

export function PlatformAdminsManager({
  currentUserId,
  initialAdmins,
  canManage,
}: {
  currentUserId: string;
  initialAdmins: AdminWithEmail[];
  canManage: boolean;
}) {
  const [admins, setAdmins] = useState(initialAdmins);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<PlatformAdminRole>("full");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function promote(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const res = await fetch("/api/admin/platform-admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const body = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to promote");
      return;
    }
    setAdmins((prev) => [body.admin, ...prev.filter((a) => a.user_id !== body.admin.user_id)]);
    setEmail("");
  }

  async function revoke(userId: string) {
    if (!confirm("Revoke Super Admin access for this user?")) return;
    setAdmins((prev) => prev.filter((a) => a.user_id !== userId));
    await fetch(`/api/admin/platform-admins/${userId}`, { method: "DELETE" });
  }

  return (
    <div className="flex flex-col gap-6">
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Promote a Super Admin</CardTitle>
            <CardDescription>
              The account must already exist — this isn&apos;t an email invite. &ldquo;Support&rdquo; can view everything and
              leave notes, but can&apos;t change plans, suspend, delete, impersonate, or manage other admins.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={promote} className="flex flex-wrap gap-2">
              <Input
                type="email"
                required
                placeholder="someone@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-w-[220px] flex-1"
              />
              <Select value={role} onValueChange={(v) => setRole(v as PlatformAdminRole)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={sending}>
                <UserPlus className="mr-1 h-4 w-4" /> {sending ? "Promoting..." : "Promote"}
              </Button>
            </form>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Super Admins</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y p-0">
          {admins.map((a) => (
            <div key={a.user_id || a.email} className="flex items-center justify-between px-6 py-2 text-sm">
              <span className="flex items-center gap-2">
                {a.email} {a.user_id === currentUserId && <span className="text-muted-foreground">(you)</span>}
                <Badge variant={a.role === "full" ? "default" : "outline"} className="capitalize">
                  {a.role}
                </Badge>
              </span>
              {canManage && a.user_id && (
                <button onClick={() => revoke(a.user_id)} aria-label="Revoke">
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </button>
              )}
            </div>
          ))}
          {admins.length === 0 && <p className="px-6 py-4 text-sm text-muted-foreground">No Super Admins yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
