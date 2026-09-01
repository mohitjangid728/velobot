"use client";

import { useRef, useState } from "react";
import { Globe, FileText, Trash2, Loader2, FileStack } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Bot, KnowledgeSource, SourceStatus } from "@velobot/shared";

const STATUS_VARIANT: Record<SourceStatus, "secondary" | "warning" | "success" | "destructive"> = {
  pending: "secondary",
  crawling: "warning",
  processing: "warning",
  ready: "success",
  failed: "destructive",
};

function quotaTone(used: number, limit: number): "default" | "warning" | "critical" {
  const pct = limit > 0 ? used / limit : 0;
  if (pct >= 1) return "critical";
  if (pct >= 0.8) return "warning";
  return "default";
}

export function SourcesPanel({
  bot,
  initialSources,
  pagesUsed,
  pagesLimit,
}: {
  bot: Bot;
  initialSources: KnowledgeSource[];
  pagesUsed: number;
  pagesLimit: number;
}) {
  const [sources, setSources] = useState(initialSources);
  const [used, setUsed] = useState(pagesUsed);
  const [url, setUrl] = useState("");
  const [crawling, setCrawling] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function addWebsite(e: React.FormEvent) {
    e.preventDefault();
    setCrawling(true);
    setError(null);
    const res = await fetch(`/api/bots/${bot.id}/sources/website`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, max_pages: 150 }),
    });
    const body = await res.json();
    setCrawling(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to crawl website");
      return;
    }
    setSources((prev) => [body.source, ...prev]);
    setUsed((prev) => prev + (body.source.pages_crawled ?? 0));
    setUrl("");
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/bots/${bot.id}/sources/upload`, { method: "POST", body: formData });
    const body = await res.json();
    setUploading(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to process file");
      return;
    }
    setSources((prev) => [body.source, ...prev]);
    setUsed((prev) => prev + (body.source.pages_crawled ?? 0));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function removeSource(source: KnowledgeSource) {
    setSources((prev) => prev.filter((s) => s.id !== source.id));
    setUsed((prev) => Math.max(0, prev - (source.pages_crawled ?? 0)));
    await fetch(`/api/bots/${bot.id}/sources/${source.id}`, { method: "DELETE" });
  }

  const remaining = Math.max(0, pagesLimit - used);

  return (
    <div className="flex flex-col gap-6 py-4">
      <Card>
        <CardContent className="flex flex-col gap-2 p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-medium">
              <FileStack className="h-4 w-4 text-muted-foreground" /> Pages indexed across your plan
            </span>
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{used.toLocaleString()}</span> / {pagesLimit.toLocaleString()} ·{" "}
              {remaining.toLocaleString()} remaining
            </span>
          </div>
          <Progress value={(used / pagesLimit) * 100} tone={quotaTone(used, pagesLimit)} />
          <p className="text-xs text-muted-foreground">
            Shared across every bot in your workspace — upgrading your plan raises this limit for all of them.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4" /> Crawl a website
            </CardTitle>
            <CardDescription>We&apos;ll follow the sitemap (or links from the root URL) and extract clean text.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={addWebsite} className="flex gap-2">
              <Input
                type="url"
                required
                placeholder="https://yoursite.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={crawling}
              />
              <Button type="submit" disabled={crawling}>
                {crawling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crawl"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" /> Upload a document
            </CardTitle>
            <CardDescription>PDF, DOCX, TXT, or Markdown, up to 15MB.</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md,.markdown"
              onChange={uploadFile}
              disabled={uploading}
            />
            {uploading && <p className="mt-2 text-sm text-muted-foreground">Parsing and embedding...</p>}
          </CardContent>
        </Card>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-col divide-y rounded-lg border">
        {sources.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No knowledge sources yet.</p>
        ) : (
          sources.map((source) => (
            <div key={source.id} className="flex items-center justify-between gap-4 p-4">
              <div className="flex min-w-0 items-center gap-3">
                {source.type === "website" ? <Globe className="h-4 w-4 shrink-0 text-muted-foreground" /> : <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{source.source_url ?? source.file_path}</p>
                  {source.error_message && <p className="truncate text-xs text-destructive">{source.error_message}</p>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {source.pages_crawled > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {source.pages_crawled.toLocaleString()} {source.pages_crawled === 1 ? "page" : "pages"}
                  </span>
                )}
                <Badge variant={STATUS_VARIANT[source.status]}>{source.status}</Badge>
                <button onClick={() => removeSource(source)} aria-label="Remove source">
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
