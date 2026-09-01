"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Bot } from "@velobot/shared";

export function BotGuardrailsPanel({ bot, onUpdated }: { bot: Bot; onUpdated: (bot: Bot) => void }) {
  // `?? default`s guard against a bot row fetched before migration 008 has
  // been applied, where these columns don't exist yet and come back undefined.
  const [enabled, setEnabled] = useState(bot.guardrails_enabled ?? false);
  const [topics, setTopics] = useState((bot.guardrails_blocked_topics ?? []).join(", "));
  const [redirectMessage, setRedirectMessage] = useState(bot.guardrails_redirect_message ?? "");
  const [piiRedaction, setPiiRedaction] = useState(bot.guardrails_pii_redaction_enabled ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/bots/${bot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guardrails_enabled: enabled,
        guardrails_blocked_topics: topics
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        guardrails_redirect_message: redirectMessage || null,
        guardrails_pii_redaction_enabled: piiRedaction,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error?.formErrors?.join(", ") ?? body.error ?? "Failed to save");
      return;
    }
    setSaved(true);
    onUpdated(body.bot);
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Guardrails</CardTitle>
        <CardDescription>Keep the bot on-topic and reduce what ends up stored in transcripts.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Restrict topics</p>
              <p className="text-xs text-muted-foreground">Bot declines to discuss the topics below.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {enabled && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="topics">Blocked topics</Label>
                <Input
                  id="topics"
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  placeholder="competitor pricing, medical advice, legal advice"
                />
                <p className="text-xs text-muted-foreground">Comma-separated. The bot is instructed to decline these, not blocked by a hard filter.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="redirect">Decline message</Label>
                <Textarea
                  id="redirect"
                  value={redirectMessage}
                  onChange={(e) => setRedirectMessage(e.target.value)}
                  placeholder="I'm not able to help with that here, but I'm happy to help with anything else related to our product."
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">Leave blank to use a sensible default.</p>
              </div>
            </>
          )}

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Redact sensitive numbers</p>
              <p className="text-xs text-muted-foreground">
                Strips credit-card- and SSN-like number patterns from the bot&apos;s own replies before they&apos;re stored. Emails and
                phone numbers are left alone since bots often need to collect those.
              </p>
            </div>
            <Switch checked={piiRedaction} onCheckedChange={setPiiRedaction} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {saved && <p className="text-sm text-emerald-600">Saved.</p>}
          <Button type="submit" disabled={saving} className="w-fit">
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
