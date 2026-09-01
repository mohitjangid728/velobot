"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Send, UserPlus, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CannedReplySearch } from "@/components/inbox/canned-reply-search";
import type { CannedReply, Conversation, Message, Role } from "@velobot/shared";

function Bubble({ message }: { message: Message }) {
  if (message.role === "system") {
    return (
      <div className="my-2 text-center text-xs text-muted-foreground">
        {message.content} · {format(new Date(message.created_at), "p")}
      </div>
    );
  }

  // Only the current agent's own outgoing replies go on the right, like any
  // chat UI — the visitor's messages AND the AI's automated replies are
  // both "the other side" from the agent's point of view. (Previously
  // `assistant` was grouped with `agent`, which made the AI's replies look
  // like they'd been sent by a human agent.)
  const isOutgoing = message.role === "agent";
  const label = message.role === "assistant" ? "AI" : message.role === "agent" ? "Agent" : "Visitor";

  return (
    <div className={cn("flex flex-col gap-1", isOutgoing ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-lg px-3 py-2 text-sm",
          message.role === "assistant"
            ? "bg-blue-50 text-blue-900"
            : isOutgoing
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground"
        )}
      >
        {message.content}
      </div>
      <span className="px-1 text-[10px] text-muted-foreground">
        {label} · {format(new Date(message.created_at), "p")}
      </span>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex w-fit items-center gap-1 rounded-lg bg-secondary px-3 py-2.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
      <span className="px-1 text-[10px] text-muted-foreground">Visitor is typing...</span>
    </div>
  );
}

export function ConversationThread({
  conversation,
  messages,
  currentUserId,
  currentRole,
  cannedReplies,
  visitorTyping,
  onClaim,
  onResolve,
  onSend,
  onCreateCannedReply,
}: {
  conversation: Conversation;
  messages: Message[];
  currentUserId: string;
  currentRole: Role;
  cannedReplies: CannedReply[];
  visitorTyping: boolean;
  onClaim: () => void;
  onResolve: () => void;
  onSend: (content: string) => void;
  onCreateCannedReply: (reply: CannedReply) => void;
}) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Keyed on the id of the latest message (not just messages.length) so
  // switching to a different conversation — same length, different
  // content — still scrolls to that thread's bottom instead of leaving
  // the scroll position wherever the previous thread had it. Also
  // re-scrolls when the typing indicator appears, since that's new
  // content at the bottom too.
  const lastMessageId = messages[messages.length - 1]?.id;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lastMessageId, conversation.id, visitorTyping]);

  const isMine = conversation.assigned_agent_id === currentUserId;
  const canReply = conversation.status === "assigned" && isMine;
  const canResolve = conversation.status === "assigned" && (isMine || currentRole !== "agent");

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    onSend(draft.trim());
    setDraft("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-2.5">
        <div>
          <p className="text-sm font-semibold">{conversation.visitor_email || "Anonymous visitor"}</p>
          <p className="text-xs text-muted-foreground capitalize">{conversation.status}</p>
        </div>
        <div className="flex gap-2">
          {conversation.status === "queued" && (
            <Button size="sm" onClick={onClaim}>
              <UserPlus className="mr-1 h-4 w-4" /> Claim
            </Button>
          )}
          {canResolve && (
            <Button size="sm" variant="outline" onClick={onResolve}>
              <CheckCircle2 className="mr-1 h-4 w-4" /> Resolve
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-4">
        <div className="flex flex-col gap-3 py-4">
          {messages.map((m) => (
            <Bubble key={m.id} message={m} />
          ))}
          {visitorTyping && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <form onSubmit={handleSend} className="flex shrink-0 items-end gap-2 border-t p-3">
        <CannedReplySearch
          cannedReplies={cannedReplies}
          onSelect={(content) => setDraft((d) => (d ? `${d} ${content}` : content))}
          onCreated={onCreateCannedReply}
        />
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
          placeholder={
            conversation.status === "queued"
              ? "Claim this ticket to reply"
              : canReply
                ? "Type a reply..."
                : "Only the assigned agent can reply"
          }
          disabled={!canReply}
          className="min-h-[40px] flex-1 resize-none"
        />
        <Button type="submit" size="icon" disabled={!canReply || !draft.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
