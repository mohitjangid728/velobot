"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Conversation } from "@velobot/shared";

const STATUS_LABEL: Record<Conversation["status"], string> = {
  ai: "With AI",
  queued: "Waiting",
  assigned: "Assigned",
  resolved: "Resolved",
};

/**
 * Text search across the org's conversations (visitor email/session id and
 * message content — see app/api/conversations/search/route.ts), scoped to
 * the agent's queues server-side. Renders as a dropdown overlaying the
 * queue list below it (a fixed-position panel keeps the surrounding
 * 3-column layout's height math untouched, rather than swapping content
 * in and out of the same flex column) — this is the only search in the
 * Inbox; canned-reply search stays local/in-memory since that list is
 * small and already fully fetched.
 */
export function ConversationSearch({ onSelect }: { onSelect: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Conversation[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(() => {
      fetch(`/api/conversations/search?q=${encodeURIComponent(trimmed)}`)
        .then((r) => r.json())
        .then((body) => setResults(body.conversations ?? []))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const open = results !== null;

  return (
    <div className="relative shrink-0 border-b bg-card p-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations..."
          className="h-8 pl-8 pr-8 text-sm"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute inset-x-2 top-full z-20 mt-1 max-h-[60vh] overflow-y-auto rounded-md border bg-popover shadow-lg">
          {loading && <p className="px-3 py-3 text-xs text-muted-foreground">Searching...</p>}
          {!loading && results.length === 0 && <p className="px-3 py-3 text-xs text-muted-foreground">No matches.</p>}
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                onSelect(c.id);
                setQuery("");
              }}
              className="flex w-full flex-col gap-0.5 border-b px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-secondary"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{c.visitor_email || `Visitor · ${c.session_id.slice(0, 8)}`}</span>
                <Badge variant="secondary" className="shrink-0">
                  {STATUS_LABEL[c.status]}
                </Badge>
              </div>
              <span className="truncate text-xs text-muted-foreground">
                {c.visitor_url ?? "Unknown page"} · {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true })}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
