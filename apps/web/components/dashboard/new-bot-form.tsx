"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot as BotIcon, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { WidgetPreview } from "@/components/dashboard/widget-preview";
import { BotTemplatePicker } from "@/components/dashboard/bot-template-picker";
import { trackEvent } from "@/lib/analytics/posthog";
import type { BotTemplate } from "@/lib/bot-templates";
import type { Queue } from "@velobot/shared";

const NO_QUEUE = "__none__";

const BLANK_DEFAULTS = {
  description: "",
  welcomeMessage: "Hi! How can I help you today?",
  systemPromptExtra: "",
  themeColor: "#4F46E5",
  fallbackEmail: true,
};

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function NewBotForm({ queues }: { queues: Queue[] }) {
  const router = useRouter();
  const [template, setTemplate] = useState<BotTemplate | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("Hi! How can I help you today?");
  const [themeColor, setThemeColor] = useState("#4F46E5");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [launcherIconUrl, setLauncherIconUrl] = useState("");
  const [domains, setDomains] = useState("");
  const [systemPromptExtra, setSystemPromptExtra] = useState("");
  const [fallbackEmail, setFallbackEmail] = useState(true);
  const [queueId, setQueueId] = useState(NO_QUEUE);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function applyTemplate(chosen: BotTemplate | null) {
    const defaults = chosen?.defaults ?? BLANK_DEFAULTS;
    setDescription(defaults.description);
    setWelcomeMessage(defaults.welcomeMessage);
    setSystemPromptExtra(defaults.systemPromptExtra);
    setThemeColor(defaults.themeColor);
    setFallbackEmail(defaults.fallbackEmail);
    setTemplate(chosen);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/bots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || undefined,
        welcome_message: welcomeMessage,
        theme_color: themeColor,
        avatar_url: avatarUrl || null,
        launcher_icon_url: launcherIconUrl || null,
        allowed_domains: domains.split(",").map((d) => d.trim()).filter(Boolean),
        system_prompt_extra: systemPromptExtra || null,
        fallback_email_enabled: fallbackEmail,
        queue_id: queueId === NO_QUEUE ? null : queueId,
      }),
    });
    const body = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(body.error?.formErrors?.join(", ") ?? body.error ?? "Could not create bot.");
      return;
    }
    trackEvent("bot_created", { bot_id: body.bot.id });
    router.push(`/dashboard/bots/${body.bot.id}`);
  }

  if (template === undefined) {
    return <BotTemplatePicker onSelect={applyTemplate} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setTemplate(undefined)}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {template ? `Template: ${template.label}` : "Starting from scratch"} · Change
      </button>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardContent className="flex flex-col gap-8 p-6">
            <Section title="Basics">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Bot name</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Support Bot" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Answers product and billing questions"
                  rows={2}
                />
              </div>
            </Section>

            <Separator />

            <Section title="Branding" description="How the bot introduces itself and looks in the widget.">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="welcome">Welcome message</Label>
                <Input id="welcome" value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="color">Theme color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="color"
                      type="color"
                      className="h-9 w-12 p-1"
                      value={themeColor}
                      onChange={(e) => setThemeColor(e.target.value)}
                    />
                    <Input value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="font-mono text-xs" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="avatar">Avatar URL</Label>
                  <Input id="avatar" type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://.../avatar.png" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="launcher">Launcher icon URL (optional)</Label>
                <Input
                  id="launcher"
                  type="url"
                  value={launcherIconUrl}
                  onChange={(e) => setLauncherIconUrl(e.target.value)}
                  placeholder="https://.../icon.png"
                />
                <p className="text-xs text-muted-foreground">Shown on the floating chat bubble. Defaults to a chat icon.</p>
              </div>
            </Section>

            <Separator />

            <Section title="Behavior" description="Extra guidance for the AI and what happens when no agents are online.">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="prompt">Additional instructions</Label>
                <Textarea
                  id="prompt"
                  value={systemPromptExtra}
                  onChange={(e) => setSystemPromptExtra(e.target.value)}
                  placeholder="e.g. Always mention our 30-day refund policy when relevant."
                  rows={3}
                />
                {template?.actionTip && <p className="text-xs text-primary">{template.actionTip}</p>}
              </div>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">Offline email fallback</p>
                  <p className="text-xs text-muted-foreground">Collect visitor emails when no agents are online.</p>
                </div>
                <Switch checked={fallbackEmail} onCheckedChange={setFallbackEmail} />
              </div>
            </Section>

            <Separator />

            <Section title="Embed & routing" description="Where this bot is allowed to run, and who handles its escalations.">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="domains">Allowed embed domains</Label>
                <Input id="domains" value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="acme.com, app.acme.com" />
                <p className="text-xs text-muted-foreground">
                  Comma-separated. Leave blank for now — the widget refuses to load anywhere until you add at least one.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="queue">Queue</Label>
                <Select value={queueId} onValueChange={setQueueId}>
                  <SelectTrigger id="queue">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_QUEUE}>No queue — any agent can claim</SelectItem>
                    {queues.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">&quot;Talk to a human&quot; escalations route only to this queue&apos;s members.</p>
              </div>
            </Section>

            {error && <p className="text-sm text-status-critical">{error}</p>}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={loading || !name.trim()}>
                <BotIcon className="h-4 w-4" />
                {loading ? "Creating..." : "Create bot"}
              </Button>
              <p className="text-xs text-muted-foreground">You can change any of this later from the bot&apos;s Settings tab.</p>
            </div>
          </CardContent>
        </Card>

        {/*
          This column deliberately does NOT get `self-start` — it stays at the
          grid's default `stretch`, so its height matches the (much taller)
          form column. That gives the sticky child below room to stay pinned
          for the form's *entire* scroll range; without a tall-enough parent,
          `sticky` can only hold within its own natural height and the column
          runs out of content — leaving a blank gap for the rest of the form.
        */}
        <div>
          <div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
            <WidgetPreview
              config={{
                name,
                welcomeMessage,
                themeColor,
                avatarUrl: avatarUrl || undefined,
                launcherIconUrl: launcherIconUrl || undefined,
              }}
            />
          </div>
        </div>
      </form>
    </div>
  );
}
