"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminOrgNote } from "@velobot/shared";

type NoteWithAuthor = AdminOrgNote & { authorEmail: string };

export function OrgNotesCard({ orgId, initialNotes }: { orgId: string; initialNotes: NoteWithAuthor[] }) {
  const [notes, setNotes] = useState(initialNotes);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addNote() {
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    const res = await fetch(`/api/admin/orgs/${orgId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: text }),
    });
    const body = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to save note");
      return;
    }
    setNotes((prev) => [body.note, ...prev]);
    setText("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <StickyNote className="h-4 w-4" /> Support notes
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. VIP customer, disputing invoice #123, migrating from a competitor..."
            rows={2}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button size="sm" className="self-start" onClick={addNote} disabled={sending || !text.trim()}>
            {sending ? "Saving..." : "Add note"}
          </Button>
        </div>

        <div className="flex flex-col divide-y border-t pt-2">
          {notes.map((n) => (
            <div key={n.id} className="flex flex-col gap-0.5 py-2 text-sm">
              <p>{n.note}</p>
              <span className="text-xs text-muted-foreground">
                {n.authorEmail} · {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
              </span>
            </div>
          ))}
          {notes.length === 0 && <p className="py-2 text-sm text-muted-foreground">No notes yet.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
