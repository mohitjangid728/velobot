"use client";

import { useState } from "react";
import { Plus, Trash2, UserRoundPlus, UsersRound, X, Bot as BotIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Queue, QueueMember } from "@velobot/shared";

interface OrgMemberOption {
  userId: string;
  email: string;
}
interface BotOption {
  id: string;
  name: string;
  queue_id: string | null;
}

function initials(email: string) {
  return (email.trim()[0] || "?").toUpperCase();
}

function AddMemberPopover({
  candidates,
  onAdd,
}: {
  candidates: OrgMemberOption[];
  onAdd: (userId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = candidates.filter((m) => m.email.toLowerCase().includes(query.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <UserRoundPlus className="h-3.5 w-3.5" /> Add member
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="border-b p-2">
          <Input placeholder="Search teammates..." value={query} onChange={(e) => setQuery(e.target.value)} autoFocus className="h-8" />
        </div>
        <div className="max-h-56 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="p-3 text-center text-xs text-muted-foreground">
              {candidates.length === 0 ? "Everyone's already in this queue." : "No match."}
            </p>
          ) : (
            filtered.map((m) => (
              <button
                key={m.userId}
                onClick={() => {
                  onAdd(m.userId);
                  setOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">
                  {initials(m.email)}
                </span>
                <span className="truncate">{m.email}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function QueueRow({
  queue,
  members,
  orgMembers,
  botNames,
  onAddMember,
  onRemoveMember,
  onDelete,
}: {
  queue: Queue;
  members: QueueMember[];
  orgMembers: OrgMemberOption[];
  botNames: string[];
  onAddMember: (userId: string) => void;
  onRemoveMember: (userId: string) => void;
  onDelete: () => void;
}) {
  const emailFor = (userId: string) => orgMembers.find((m) => m.userId === userId)?.email ?? userId;
  const candidates = orgMembers.filter((m) => !members.some((qm) => qm.user_id === m.userId));

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UsersRound className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold leading-tight">{queue.name}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <BotIcon className="h-3 w-3" />
                {botNames.length === 0
                  ? "Not routed from any bot yet"
                  : `Routed from ${botNames.join(", ")}`}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="secondary">
              {members.length} {members.length === 1 ? "member" : "members"}
            </Badge>
            <button
              onClick={onDelete}
              aria-label="Delete queue"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          {members.map((m) => (
            <span
              key={m.user_id}
              className="group flex items-center gap-1.5 rounded-full border bg-secondary/50 py-1 pl-1 pr-2.5 text-xs font-medium"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                {initials(emailFor(m.user_id))}
              </span>
              {emailFor(m.user_id)}
              <button
                onClick={() => onRemoveMember(m.user_id)}
                aria-label="Remove from queue"
                className="ml-0.5 text-muted-foreground opacity-60 transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <AddMemberPopover candidates={candidates} onAdd={onAddMember} />
        </div>
      </CardContent>
    </Card>
  );
}

export function QueueManager({
  orgId,
  initialQueues,
  initialQueueMembers,
  orgMembers,
  bots,
}: {
  orgId: string;
  initialQueues: Queue[];
  initialQueueMembers: QueueMember[];
  orgMembers: OrgMemberOption[];
  bots: BotOption[];
}) {
  const [queues, setQueues] = useState(initialQueues);
  const [queueMembers, setQueueMembers] = useState(initialQueueMembers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function createQueue(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch(`/api/orgs/${orgId}/queues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setCreating(false);
    if (res.ok) {
      const body = await res.json();
      setQueues((prev) => [...prev, body.queue]);
      setNewName("");
      setDialogOpen(false);
    }
  }

  async function deleteQueue(queueId: string) {
    if (!confirm("Delete this queue? Bots assigned to it will fall back to \"any agent can claim\".")) return;
    setQueues((prev) => prev.filter((q) => q.id !== queueId));
    await fetch(`/api/orgs/${orgId}/queues/${queueId}`, { method: "DELETE" });
  }

  async function addMember(queueId: string, userId: string) {
    setQueueMembers((prev) => [...prev, { queue_id: queueId, user_id: userId, created_at: new Date().toISOString() }]);
    await fetch(`/api/orgs/${orgId}/queues/${queueId}/members/${userId}`, { method: "POST" });
  }

  async function removeMember(queueId: string, userId: string) {
    setQueueMembers((prev) => prev.filter((m) => !(m.queue_id === queueId && m.user_id === userId)));
    await fetch(`/api/orgs/${orgId}/queues/${queueId}/members/${userId}`, { method: "DELETE" });
  }

  const totalRouted = bots.filter((b) => b.queue_id).length;

  return (
    <div className="flex flex-col gap-5">
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={createQueue}>
            <DialogHeader>
              <DialogTitle>New queue</DialogTitle>
              <DialogDescription>Give it a name like &ldquo;Sales&rdquo; or &ldquo;Support&rdquo;.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <Input
                autoFocus
                placeholder="e.g. Sales, Support"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </DialogBody>
            <DialogFooter>
              <Button type="submit" disabled={creating || !newName.trim()}>
                {creating ? "Creating..." : "Create queue"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {queues.length} {queues.length === 1 ? "queue" : "queues"} · {totalRouted} of {bots.length} bots routed to a queue
        </p>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> New queue
        </Button>
      </div>

      {queues.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UsersRound className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium">No queues yet</p>
              <p className="text-sm text-muted-foreground">
                Without one, every bot&apos;s escalations go to any agent in the workspace.
              </p>
            </div>
            <Button className="mt-2" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> New queue
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {queues.map((queue) => (
            <QueueRow
              key={queue.id}
              queue={queue}
              members={queueMembers.filter((m) => m.queue_id === queue.id)}
              orgMembers={orgMembers}
              botNames={bots.filter((b) => b.queue_id === queue.id).map((b) => b.name)}
              onAddMember={(userId) => addMember(queue.id, userId)}
              onRemoveMember={(userId) => removeMember(queue.id, userId)}
              onDelete={() => deleteQueue(queue.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
