"use client";

import { useState } from "react";
import { Mail, Trash2, UsersRound, Clock, Copy, RotateCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Invite, OrgMember, Role } from "@velobot/shared";

type MemberWithEmail = OrgMember & { email: string };

function initials(email: string) {
  return (email.trim()[0] || "?").toUpperCase();
}

function quotaTone(used: number, limit: number): "default" | "warning" | "critical" {
  const pct = limit > 0 ? used / limit : 0;
  if (pct >= 1) return "critical";
  if (pct >= 0.8) return "warning";
  return "default";
}

export function TeamManager({
  orgId,
  currentRole,
  seatsLimit,
  initialMembers,
  initialInvites,
}: {
  orgId: string;
  currentRole: Role;
  seatsLimit: number;
  initialMembers: MemberWithEmail[];
  initialInvites: Invite[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "agent">("agent");
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const res = await fetch(`/api/orgs/${orgId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const body = await res.json();
    setSending(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to send invite");
      return;
    }
    setInvites((prev) => [body.invite, ...prev]);
    setEmail("");
  }

  async function updateRole(memberId: string, newRole: "admin" | "agent") {
    const previous = members;
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)));
    setActionError(null);
    const res = await fetch(`/api/orgs/${orgId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMembers(previous);
      setActionError(body.error ?? "Failed to update role");
    }
  }

  async function removeMember(memberId: string) {
    const previous = members;
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    setActionError(null);
    const res = await fetch(`/api/orgs/${orgId}/members/${memberId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMembers(previous);
      setActionError(body.error ?? "Failed to remove member");
    }
  }

  async function resendInvite(inviteId: string) {
    setResendingId(inviteId);
    setActionError(null);
    const res = await fetch(`/api/orgs/${orgId}/invites/${inviteId}/resend`, { method: "POST" });
    setResendingId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setActionError(body.error ?? "Failed to resend invite");
    }
  }

  function copyInviteLink(inv: Invite) {
    const url = `${window.location.origin}/accept-invite?token=${inv.token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(inv.id);
      setTimeout(() => setCopiedId((id) => (id === inv.id ? null : id)), 2000);
    });
  }

  const seatsUsed = members.length + invites.length;
  const canManage = currentRole !== "agent";
  const adminCount = members.filter((m) => m.role === "admin").length;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-2 p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-medium">
              <UsersRound className="h-4 w-4 text-muted-foreground" /> Seats used
            </span>
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{seatsUsed}</span> / {seatsLimit}
            </span>
          </div>
          <Progress value={(seatsUsed / seatsLimit) * 100} tone={quotaTone(seatsUsed, seatsLimit)} />
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" /> Invite a teammate
            </CardTitle>
            <CardDescription>
              They&apos;ll get an email to set up their account. If it doesn&apos;t arrive, you can resend it or copy the invite
              link from the pending list below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={sendInvite} className="flex flex-wrap items-end gap-2">
              <Input
                type="email"
                required
                placeholder="teammate@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-64"
              />
              <Select value={role} onValueChange={(v) => setRole(v as "admin" | "agent")}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={sending || seatsUsed >= seatsLimit}>
                <Mail className="h-4 w-4" /> {sending ? "Sending..." : "Send invite"}
              </Button>
            </form>
            {seatsUsed >= seatsLimit && (
              <p className="mt-2 text-xs text-status-critical">
                You&apos;re at your seat limit — buy an extra seat or upgrade your plan from Billing to invite more.
              </p>
            )}
            {error && <p className="mt-2 text-sm text-status-critical">{error}</p>}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Members</h2>
        {actionError && <p className="text-sm text-status-critical">{actionError}</p>}
        <div className="flex flex-col gap-2">
          {members.map((m) => {
            const isLastAdmin = m.role === "admin" && adminCount <= 1;
            return (
              <Card key={m.id}>
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {initials(m.email)}
                    </div>
                    <p className="truncate text-sm font-medium">{m.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {isLastAdmin ? (
                      <Badge title="The last admin can't be demoted or removed — promote someone else first.">Admin</Badge>
                    ) : !canManage ? (
                      <Badge variant="secondary" className="capitalize">
                        {m.role}
                      </Badge>
                    ) : (
                      <Select value={m.role} onValueChange={(v) => updateRole(m.id, v as "admin" | "agent")}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="agent">Agent</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {!isLastAdmin && canManage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMember(m.id)}
                        aria-label="Remove member"
                        className="text-muted-foreground hover:text-status-critical"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {invites.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Pending invites</h2>
          <div className="flex flex-col gap-2">
            {invites.map((inv) => (
              <Card key={inv.id} className="border-dashed shadow-none">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Clock className="h-4 w-4" />
                    </div>
                    <p className="truncate text-sm font-medium">{inv.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="warning" className="capitalize">
                      {inv.role} · pending
                    </Badge>
                    {canManage && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyInviteLink(inv)}
                          aria-label="Copy invite link"
                          title="Copy invite link"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {copiedId === inv.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => resendInvite(inv.id)}
                          disabled={resendingId === inv.id}
                          aria-label="Resend invite"
                          title="Resend invite"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <RotateCw className={`h-4 w-4 ${resendingId === inv.id ? "animate-spin" : ""}`} />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
