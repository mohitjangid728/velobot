"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Bot, LlmModel, LlmResponseLength } from "@velobot/shared";

export function BotLlmPanel({ bot, onUpdated }: { bot: Bot; onUpdated: (bot: Bot) => void }) {
  // `?? default`s guard against a bot row fetched before migration 008 has
  // been applied, where these columns don't exist yet and come back
  // undefined — `temperature.toFixed()` below would throw otherwise.
  const [model, setModel] = useState<LlmModel>(bot.llm_model ?? "gpt-4o-mini");
  const [temperature, setTemperature] = useState(bot.llm_temperature ?? 0.3);
  const [responseLength, setResponseLength] = useState<LlmResponseLength>(bot.llm_response_length ?? "balanced");
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
      body: JSON.stringify({ llm_model: model, llm_temperature: temperature, llm_response_length: responseLength }),
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
        <CardTitle>AI model</CardTitle>
        <CardDescription>Controls which model answers and how it responds.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="model">Model</Label>
            <Select value={model} onValueChange={(v) => setModel(v as LlmModel)}>
              <SelectTrigger id="model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4o-mini">GPT-4o mini — fast, lower cost</SelectItem>
                <SelectItem value="gpt-4o">GPT-4o — more capable, higher cost</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="length">Response length</Label>
            <Select value={responseLength} onValueChange={(v) => setResponseLength(v as LlmResponseLength)}>
              <SelectTrigger id="length">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="concise">Concise — 1-2 sentences</SelectItem>
                <SelectItem value="balanced">Balanced — short paragraphs</SelectItem>
                <SelectItem value="detailed">Detailed — thorough explanations</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="temperature">Creativity</Label>
              <span className="text-xs text-muted-foreground">{temperature.toFixed(2)}</span>
            </div>
            <input
              id="temperature"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Precise &amp; consistent</span>
              <span>More varied</span>
            </div>
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
