"use client";

import { formatDistanceToNow } from "date-fns";
import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { Conversation } from "@velobot/shared";

function initials(conversation: Conversation) {
  const source = conversation.visitor_email || conversation.session_id;
  return source.slice(0, 1).toUpperCase();
}

/** Minutes waited past which the badge turns amber, then destructive — tunable, not a hard product spec. */
const SLA_WARNING_MINUTES = 5;
const SLA_CRITICAL_MINUTES = 15;

function WaitBadge({ since }: { since: string }) {
  const minutes = (Date.now() - new Date(since).getTime()) / 60000;
  const tone = minutes >= SLA_CRITICAL_MINUTES ? "destructive" : minutes >= SLA_WARNING_MINUTES ? "warning" : "secondary";
  return (
    <Badge variant={tone} className="shrink-0">
      Waiting {formatDistanceToNow(new Date(since))}
    </Badge>
  );
}

function ConversationRow({
  conversation,
  active,
  showWait,
  onClick,
}: {
  conversation: Conversation;
  active: boolean;
  showWait?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-secondary",
        active && "bg-accent"
      )}
    >
      {active && <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-primary" />}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
        )}
      >
        {initials(conversation)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">
            {conversation.visitor_email || `Visitor · ${conversation.session_id.slice(0, 8)}`}
          </span>
          {conversation.unread_by_agent && <Circle className="h-2 w-2 shrink-0 fill-primary text-primary" />}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="truncate">{conversation.visitor_url ?? "Unknown page"}</span>
          {showWait ? (
            <WaitBadge since={conversation.queued_at ?? conversation.created_at} />
          ) : (
            <span className="shrink-0">{formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })}</span>
          )}
        </div>
      </div>
    </button>
  );
}

export function QueueList({
  conversations,
  selectedId,
  currentUserId,
  onSelect,
}: {
  conversations: Conversation[];
  selectedId: string | null;
  currentUserId: string;
  onSelect: (id: string) => void;
}) {
  const unassigned = conversations
    .filter((c) => c.status === "queued")
    .sort((a, b) => new Date(a.queued_at ?? a.created_at).getTime() - new Date(b.queued_at ?? b.created_at).getTime());
  const mine = conversations
    .filter((c) => c.status === "assigned" && c.assigned_agent_id === currentUserId)
    .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
  const others = conversations.filter((c) => c.status === "assigned" && c.assigned_agent_id !== currentUserId);
  const resolved = conversations
    .filter((c) => c.status === "resolved")
    .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
    .slice(0, 20);

  return (
    <ScrollArea className="h-full min-h-0 bg-card">
      <Section title="Unassigned" badge={unassigned.length} tone={unassigned.length > 0 ? "warning" : "secondary"}>
        {unassigned.map((c) => (
          <ConversationRow key={c.id} conversation={c} active={c.id === selectedId} showWait onClick={() => onSelect(c.id)} />
        ))}
      </Section>
      <Section title="My conversations" badge={mine.length} tone="secondary">
        {mine.map((c) => (
          <ConversationRow key={c.id} conversation={c} active={c.id === selectedId} onClick={() => onSelect(c.id)} />
        ))}
      </Section>
      {others.length > 0 && (
        <Section title="Other agents" badge={others.length} tone="secondary">
          {others.map((c) => (
            <ConversationRow key={c.id} conversation={c} active={c.id === selectedId} onClick={() => onSelect(c.id)} />
          ))}
        </Section>
      )}
      <Section title="Recently resolved" badge={resolved.length} tone="secondary">
        {resolved.map((c) => (
          <ConversationRow key={c.id} conversation={c} active={c.id === selectedId} onClick={() => onSelect(c.id)} />
        ))}
      </Section>
    </ScrollArea>
  );
}

function Section({
  title,
  badge,
  tone,
  children,
}: {
  title: string;
  badge: number;
  tone: BadgeProps["variant"];
  children: React.ReactNode;
}) {
  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
        <Badge variant={tone}>{badge}</Badge>
      </div>
      {badge === 0 ? (
        <p className="px-3 pb-3 text-xs text-muted-foreground">Nothing here.</p>
      ) : (
        <div className="flex flex-col pb-1">{children}</div>
      )}
    </div>
  );
}
