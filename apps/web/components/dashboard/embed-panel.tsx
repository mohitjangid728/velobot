"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Bot } from "@velobot/shared";

export function EmbedPanel({ bot }: { bot: Bot }) {
  const [copied, setCopied] = useState(false);
  const cdnUrl = process.env.NEXT_PUBLIC_WIDGET_CDN_URL ?? "https://cdn.yourdomain.com/widget.js";
  const snippet = `<script src="${cdnUrl}" data-bot-id="${bot.id}" defer></script>`;

  async function copy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Embed this bot</CardTitle>
        <CardDescription>
          Paste this before <code>&lt;/body&gt;</code> on any domain listed in Settings → Allowed embed domains.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 rounded-md border bg-muted p-3 font-mono text-sm">
          <code className="flex-1 overflow-x-auto whitespace-pre">{snippet}</code>
          <Button size="icon" variant="ghost" onClick={copy} aria-label="Copy snippet">
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Bot ID: <code>{bot.id}</code>
        </p>
      </CardContent>
    </Card>
  );
}
