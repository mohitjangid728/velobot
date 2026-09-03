"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/marketing/markdown-content";
import type { LegalPage, LegalPageSlug } from "@velobot/shared";

export function LegalPageEditor({
  slug,
  initialPage,
  canManage,
}: {
  slug: LegalPageSlug;
  initialPage: LegalPage;
  canManage: boolean;
}) {
  const [title, setTitle] = useState(initialPage.title);
  const [content, setContent] = useState(initialPage.content_markdown);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/admin/legal/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content_markdown: content }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to save");
      return;
    }
    setSaved(true);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="legal-title">Page title</Label>
            <Input id="legal-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canManage} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="legal-content">Content (Markdown)</Label>
            <Textarea
              id="legal-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={!canManage}
              rows={24}
              className="font-mono text-xs"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {saved && <p className="text-sm text-status-good">Saved.</p>}
          {canManage && (
            <Button onClick={save} disabled={saving} className="w-fit">
              {saving ? "Saving..." : "Save changes"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose-legal flex flex-col gap-5 text-sm leading-relaxed text-foreground [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted-foreground [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
            <MarkdownContent markdown={content} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
