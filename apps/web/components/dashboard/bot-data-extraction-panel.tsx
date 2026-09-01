"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Bot } from "@velobot/shared";

export function BotDataExtractionPanel({ bot, onUpdated }: { bot: Bot; onUpdated: (bot: Bot) => void }) {
  // `?? false` guards against a bot row fetched before migration 008 has
  // been applied, where this column doesn't exist yet and comes back undefined.
  const [enabled, setEnabled] = useState(bot.data_extraction_enabled ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(next: boolean) {
    setEnabled(next);
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/bots/${bot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data_extraction_enabled: next }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setEnabled(!next);
      setError(body.error?.formErrors?.join(", ") ?? body.error ?? "Failed to save");
      return;
    }
    setSaved(true);
    onUpdated(body.bot);
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Data extraction</CardTitle>
        <CardDescription>Auto-tag each conversation with intent, sentiment, and any details the visitor mentioned.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Extract from conversations</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              After each reply, a lightweight pass looks for intent, sentiment, and any email, phone, order number, or product the
              visitor explicitly mentioned. Shown to agents in the Inbox — never guessed or fabricated, and never used to auto-fill
              anything.
            </p>
          </div>
          <Switch checked={enabled} disabled={saving} onCheckedChange={save} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {saved && <p className="text-sm text-emerald-600">Saved.</p>}
      </CardContent>
    </Card>
  );
}
