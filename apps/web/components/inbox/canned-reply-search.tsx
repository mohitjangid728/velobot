"use client";

import { useState } from "react";
import { BookOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CannedReply } from "@velobot/shared";

export function CannedReplySearch({
  cannedReplies,
  onSelect,
  onCreated,
}: {
  cannedReplies: CannedReply[];
  onSelect: (content: string) => void;
  onCreated: (reply: CannedReply) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = cannedReplies.filter(
    (r) =>
      r.title.toLowerCase().includes(query.toLowerCase()) ||
      r.content.toLowerCase().includes(query.toLowerCase())
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/canned-replies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, content: newContent }),
    });
    setSaving(false);
    if (res.ok) {
      const body = await res.json();
      onCreated(body.cannedReply);
      setNewTitle("");
      setNewContent("");
      setCreating(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label="Canned replies">
          <BookOpen className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        {creating ? (
          <form onSubmit={handleCreate} className="flex flex-col gap-2 p-3">
            <Input placeholder="Title" required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} autoFocus />
            <Textarea placeholder="Reply text" required rows={3} value={newContent} onChange={(e) => setNewContent(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-center gap-1 border-b p-2">
              <Input placeholder="Search canned replies..." value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
              <Button type="button" variant="ghost" size="icon" aria-label="New canned reply" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">No canned replies found.</p>
              ) : (
                filtered.map((reply) => (
                  <button
                    key={reply.id}
                    onClick={() => {
                      onSelect(reply.content);
                      setOpen(false);
                    }}
                    className="flex w-full flex-col gap-0.5 border-b px-3 py-2 text-left last:border-b-0 hover:bg-secondary/60"
                  >
                    <span className="text-sm font-medium">{reply.title}</span>
                    <span className="line-clamp-1 text-xs text-muted-foreground">{reply.content}</span>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
