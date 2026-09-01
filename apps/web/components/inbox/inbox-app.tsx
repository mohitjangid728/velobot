"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAgentPresence } from "@/hooks/use-agent-presence";
import { QueueList } from "@/components/inbox/queue-list";
import { ConversationSearch } from "@/components/inbox/conversation-search";
import { ConversationThread } from "@/components/inbox/conversation-thread";
import { CustomerPanel } from "@/components/inbox/customer-panel";
import { AgentQuickActions } from "@/components/inbox/agent-quick-actions";
import { Button } from "@/components/ui/button";
import type { CannedReply, Conversation, Message, Role } from "@velobot/shared";

/** Synthesizes a short two-tone chime with the Web Audio API — no audio asset to bundle or fetch. */
function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.15, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.3);
    });
  } catch {
    // Audio isn't critical path — ignore if the browser blocks autoplay before any user gesture.
  }
}

const FAVICON_SELECTOR = 'link[rel="icon"]';
let cachedDefaultFaviconHref: string | null = null;

/**
 * Draws a small red dot over whatever favicon is already on the page and
 * swaps the <link> href to the composited result — reverts to the original
 * href when `hasUnread` goes false. Cached once per page load since the
 * base favicon never changes at runtime.
 */
function setFaviconBadge(hasUnread: boolean) {
  const link = document.querySelector<HTMLLinkElement>(FAVICON_SELECTOR);
  if (!link) return;
  if (cachedDefaultFaviconHref === null) cachedDefaultFaviconHref = link.href;
  if (!hasUnread) {
    link.href = cachedDefaultFaviconHref;
    return;
  }

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    try {
      const size = 32;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, size, size);
      ctx.beginPath();
      ctx.arc(size - 7, 7, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#e5484d";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      link.href = canvas.toDataURL("image/png");
    } catch {
      // A tainted canvas (cross-origin favicon without CORS headers) can't
      // be exported — the title badge already covers this case, so just
      // skip the favicon dot rather than throwing.
    }
  };
  img.src = cachedDefaultFaviconHref;
}

export function InboxApp({
  orgId,
  currentUserId,
  currentRole,
  initialConversations,
  myQueueIds,
}: {
  orgId: string;
  currentUserId: string;
  currentRole: Role;
  initialConversations: Conversation[];
  myQueueIds: string[];
}) {
  useAgentPresence(orgId);

  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(initialConversations[0]?.id ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [cannedReplies, setCannedReplies] = useState<CannedReply[]>([]);
  const [visitorTyping, setVisitorTyping] = useState(false);
  const baseTitle = useRef(typeof document !== "undefined" ? document.title : "VeloBot Inbox");
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );
  const [alertsPromptDismissed, setAlertsPromptDismissed] = useState(false);
  const selectedIdRef = useRef<string | null>(null);

  async function enableDesktopAlerts() {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotifPermission(permission);
  }

  /** Only surfaces a native OS notification when the tab genuinely isn't the thing the agent is looking at — an agent actively in the Inbox already sees the chime/badge/new row, an OS popup on top would just be noise. */
  const notify = useCallback(
    (title: string, body: string, conversationId: string) => {
      if (notifPermission !== "granted" || document.visibilityState === "visible") return;
      try {
        const n = new Notification(title, { body, tag: conversationId });
        n.onclick = () => {
          window.focus();
          setSelectedId(conversationId);
          n.close();
        };
      } catch {
        // Notification construction can throw in some embedded/insecure contexts — never worth crashing the inbox over.
      }
    },
    [notifPermission]
  );

  // Admins oversee every queue; an agent only sees tickets that are
  // unrouted (queue_id null, backward-compatible) or in one of their own
  // queues. The real boundary is server-side (requireConversationAccess
  // rejects an agent acting on an out-of-queue conversation, and the inbox
  // page's initial query never sends one down) — this filter's job is to
  // keep the visible list consistent with that once the org-wide realtime
  // subscription below pushes a row the initial query didn't include.
  const canSee = useCallback(
    (c: Conversation) => currentRole !== "agent" || c.queue_id === null || myQueueIds.includes(c.queue_id),
    [currentRole, myQueueIds]
  );
  const visibleConversations = conversations.filter(canSee);

  const selected = visibleConversations.find((c) => c.id === selectedId) ?? null;

  // Document title badge reflects the unassigned + unread queue depth, per
  // Module 4's "badge updates in the agent dashboard" requirement.
  useEffect(() => {
    const pending = visibleConversations.filter((c) => c.status === "queued" || c.unread_by_agent).length;
    document.title = pending > 0 ? `(${pending}) ${baseTitle.current}` : baseTitle.current;
    setFaviconBadge(pending > 0);
  }, [visibleConversations]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    fetch("/api/canned-replies")
      .then((r) => r.json())
      .then((body) => setCannedReplies(body.cannedReplies ?? []));
  }, []);

  // Org-wide conversation subscription drives the queue list AND the audio
  // chime/badge — a single channel covers both.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`inbox:conversations:${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `org_id=eq.${orgId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as Conversation;
            setConversations((prev) => [row, ...prev]);
            if (row.status === "queued" && canSee(row)) {
              playChime();
              notify("New conversation waiting", row.visitor_email || "A visitor needs an agent", row.id);
            }
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as Conversation;
            setConversations((prev) => {
              const existing = prev.find((c) => c.id === row.id);
              // A conversation created before this inbox session's initial
              // fetch (e.g. it started as `ai` and only became `queued`
              // later) was never in `prev` — treat this as an upsert, not
              // a pure update, or the ticket silently never appears until
              // a manual refresh.
              if (row.status === "queued" && existing?.status !== "queued" && canSee(row)) {
                playChime();
                notify("New conversation waiting", row.visitor_email || "A visitor needs an agent", row.id);
              } else if (
                row.assigned_agent_id === currentUserId &&
                row.id !== selectedIdRef.current &&
                existing &&
                existing.last_message_at !== row.last_message_at
              ) {
                // A new message landed on one of MY assigned conversations
                // while I'm looking at a different one — the per-conversation
                // messages channel below only covers the currently-selected
                // thread, so this is the only signal for "elsewhere" traffic.
                playChime();
                notify("New message", row.visitor_email || "A visitor replied", row.id);
              }
              return existing ? prev.map((c) => (c.id === row.id ? row : c)) : [row, ...prev];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, canSee, currentUserId, notify]);

  // Per-conversation message subscription, re-established whenever the
  // selected ticket changes.
  useEffect(() => {
    if (!selectedId) return;
    setMessages([]);
    setVisitorTyping(false);

    fetch(`/api/conversations/${selectedId}/messages`)
      .then((r) => r.json())
      .then((body) => setMessages(body.messages ?? []));

    fetch(`/api/conversations/${selectedId}/read`, { method: "POST" });
    setConversations((prev) => prev.map((c) => (c.id === selectedId ? { ...c, unread_by_agent: false } : c)));

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`inbox:messages:${selectedId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${selectedId}` },
        (payload) => {
          const row = payload.new as Message;
          // The agent's own sent message is already appended optimistically
          // in handleSend — this event echoes back for every subscriber
          // including the sender, so skip it if we already have that id.
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          if (row.role === "user") {
            setVisitorTyping(false);
            playChime();
            notify("New message", row.content, selectedId);
          }
        }
      )
      .subscribe();

    // Ephemeral Broadcast channel the widget sends to (see
    // apps/widget/src/realtime.ts#sendTypingSignal) — never persisted, so
    // it's a separate channel from the postgres_changes one above. Clears
    // itself if no follow-up signal arrives within the window, in case the
    // visitor's "stopped typing" signal is lost (closed tab, dropped
    // connection).
    const typingTimeout = { current: null as ReturnType<typeof setTimeout> | null };
    const typingChannel = supabase
      .channel(`typing:${selectedId}`)
      .on("broadcast", { event: "typing" }, (payload) => {
        const isTyping = !!(payload.payload as { isTyping?: boolean })?.isTyping;
        setVisitorTyping(isTyping);
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        if (isTyping) {
          typingTimeout.current = setTimeout(() => setVisitorTyping(false), 4000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(typingChannel);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, [selectedId, notify]);

  const handleClaim = useCallback(async () => {
    if (!selectedId) return;
    const res = await fetch(`/api/conversations/${selectedId}/claim`, { method: "POST" });
    if (res.ok) {
      const body = await res.json();
      setConversations((prev) => prev.map((c) => (c.id === selectedId ? body.conversation : c)));
    }
  }, [selectedId]);

  const handleResolve = useCallback(async () => {
    if (!selectedId) return;
    const res = await fetch(`/api/conversations/${selectedId}/resolve`, { method: "POST" });
    if (res.ok) {
      const body = await res.json();
      setConversations((prev) => prev.map((c) => (c.id === selectedId ? body.conversation : c)));
    }
  }, [selectedId]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!selectedId) return;
      const res = await fetch(`/api/conversations/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: selectedId, content }),
      });
      if (res.ok) {
        const body = await res.json();
        setMessages((prev) => [...prev, body.message]);
      }
    },
    [selectedId]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {notifPermission === "default" && !alertsPromptDismissed && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-secondary/50 px-4 py-2 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <BellRing className="h-4 w-4" /> Get a desktop alert for new conversations, even when this tab isn&apos;t focused.
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <Button size="sm" variant="secondary" onClick={enableDesktopAlerts}>
              Enable desktop alerts
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setAlertsPromptDismissed(true)} aria-label="Dismiss">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr_260px] divide-x overflow-hidden">
        <div className="flex h-full min-h-0 flex-col">
          <ConversationSearch onSelect={setSelectedId} />
          <div className="min-h-0 flex-1">
            <QueueList
              conversations={visibleConversations}
              selectedId={selectedId}
              currentUserId={currentUserId}
              onSelect={setSelectedId}
            />
          </div>
        </div>
        {selected ? (
          <ConversationThread
            conversation={selected}
            messages={messages}
            currentUserId={currentUserId}
            currentRole={currentRole}
            cannedReplies={cannedReplies}
            visitorTyping={visitorTyping}
            onClaim={handleClaim}
            onResolve={handleResolve}
            onSend={handleSend}
            onCreateCannedReply={(reply) => setCannedReplies((prev) => [reply, ...prev])}
          />
        ) : (
          <div className="flex items-center justify-center text-sm text-muted-foreground">Select a conversation</div>
        )}
        {selected ? (
          <div className="flex h-full flex-col divide-y overflow-y-auto">
            <CustomerPanel conversation={selected} />
            <AgentQuickActions conversation={selected} />
          </div>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
