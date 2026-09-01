"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Bot, BusinessHours, Queue, Weekday } from "@velobot/shared";

const NO_QUEUE = "__none__";
const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];
const DEFAULT_HOURS: BusinessHours = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  days: {
    mon: { open: "09:00", close: "17:00" },
    tue: { open: "09:00", close: "17:00" },
    wed: { open: "09:00", close: "17:00" },
    thu: { open: "09:00", close: "17:00" },
    fri: { open: "09:00", close: "17:00" },
    sat: null,
    sun: null,
  },
};

export function BotSettingsPanel({
  bot,
  queues,
  hasRemoveBranding,
  onUpdated,
}: {
  bot: Bot;
  queues: Queue[];
  hasRemoveBranding: boolean;
  onUpdated: (bot: Bot) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(bot.name);
  const [welcomeMessage, setWelcomeMessage] = useState(bot.welcome_message);
  const [themeColor, setThemeColor] = useState(bot.theme_color);
  const [avatarUrl, setAvatarUrl] = useState(bot.avatar_url ?? "");
  const [launcherIconUrl, setLauncherIconUrl] = useState(bot.launcher_icon_url ?? "");
  const [domains, setDomains] = useState(bot.allowed_domains.join(", "));
  const [systemPromptExtra, setSystemPromptExtra] = useState(bot.system_prompt_extra ?? "");
  const [fallbackEmail, setFallbackEmail] = useState(bot.fallback_email_enabled);
  const [queueId, setQueueId] = useState(bot.queue_id ?? NO_QUEUE);
  const [brandingRemoved, setBrandingRemoved] = useState(bot.branding_removed ?? false);
  const [limitHours, setLimitHours] = useState(bot.business_hours !== null);
  const [businessHours, setBusinessHours] = useState<BusinessHours>(bot.business_hours ?? DEFAULT_HOURS);
  const [consentEnabled, setConsentEnabled] = useState(bot.consent_banner_enabled ?? false);
  const [consentText, setConsentText] = useState(bot.consent_banner_text ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function setDayHours(day: Weekday, hours: { open: string; close: string } | null) {
    setBusinessHours((prev) => ({ ...prev, days: { ...prev.days, [day]: hours } }));
  }

  async function handleDelete() {
    if (!confirm(`Delete "${bot.name}"? This removes all its knowledge sources and conversations.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/bots/${bot.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/dashboard/bots");
      router.refresh();
    } else {
      setDeleting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/bots/${bot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        welcome_message: welcomeMessage,
        theme_color: themeColor,
        avatar_url: avatarUrl || null,
        launcher_icon_url: launcherIconUrl || null,
        allowed_domains: domains.split(",").map((d) => d.trim()).filter(Boolean),
        system_prompt_extra: systemPromptExtra || null,
        fallback_email_enabled: fallbackEmail,
        queue_id: queueId === NO_QUEUE ? null : queueId,
        branding_removed: hasRemoveBranding ? brandingRemoved : false,
        business_hours: limitHours ? businessHours : null,
        consent_banner_enabled: consentEnabled,
        consent_banner_text: consentText || null,
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
        <CardTitle>Bot settings</CardTitle>
        <CardDescription>Branding, allowed embed domains, and custom instructions.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="welcome">Welcome message</Label>
            <Input id="welcome" value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="color">Theme color</Label>
            <Input id="color" type="color" className="h-10 w-20 p-1" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="avatar">Avatar URL</Label>
            <Input id="avatar" type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://.../avatar.png" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="launcher">Launcher icon URL</Label>
            <Input
              id="launcher"
              type="url"
              value={launcherIconUrl}
              onChange={(e) => setLauncherIconUrl(e.target.value)}
              placeholder="https://.../icon.png"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="domains">Allowed embed domains</Label>
            <Input id="domains" value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="acme.com, app.acme.com" />
            <p className="text-xs text-muted-foreground">Comma-separated. The widget refuses to load anywhere else.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prompt">Additional instructions</Label>
            <Textarea id="prompt" value={systemPromptExtra} onChange={(e) => setSystemPromptExtra(e.target.value)} placeholder="e.g. Always mention our 30-day refund policy when relevant." />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Offline email fallback</p>
              <p className="text-xs text-muted-foreground">Collect visitor emails when no agents are online.</p>
            </div>
            <Switch checked={fallbackEmail} onCheckedChange={setFallbackEmail} />
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
            <p className="text-xs text-muted-foreground">
              &ldquo;Talk to a human&rdquo; escalations route only to this queue&apos;s members. Manage queues
              from the Queues page in the sidebar.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Remove &ldquo;Powered by VeloBot&rdquo;</p>
              <p className="text-xs text-muted-foreground">
                {hasRemoveBranding ? "Hides the branding footer in the widget." : "Business-plan feature — upgrade from Billing to enable."}
              </p>
            </div>
            <Switch checked={brandingRemoved} disabled={!hasRemoveBranding} onCheckedChange={setBrandingRemoved} />
          </div>

          <div className="flex flex-col gap-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Business hours</p>
                <p className="text-xs text-muted-foreground">Show visitors an offline notice outside these hours.</p>
              </div>
              <Switch checked={limitHours} onCheckedChange={setLimitHours} />
            </div>
            {limitHours && (
              <div className="flex flex-col gap-2 border-t pt-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tz">Timezone</Label>
                  <Input
                    id="tz"
                    value={businessHours.timezone}
                    onChange={(e) => setBusinessHours((prev) => ({ ...prev, timezone: e.target.value }))}
                    placeholder="America/New_York"
                  />
                </div>
                {WEEKDAYS.map(({ key, label }) => {
                  const hours = businessHours.days[key];
                  return (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <span className="w-9 shrink-0 text-muted-foreground">{label}</span>
                      <Switch
                        checked={hours !== null}
                        onCheckedChange={(checked) => setDayHours(key, checked ? { open: "09:00", close: "17:00" } : null)}
                      />
                      {hours ? (
                        <>
                          <input
                            type="time"
                            value={hours.open}
                            onChange={(e) => setDayHours(key, { ...hours, open: e.target.value })}
                            className="rounded-md border bg-background px-2 py-1 text-sm"
                          />
                          <span className="text-muted-foreground">to</span>
                          <input
                            type="time"
                            value={hours.close}
                            onChange={(e) => setDayHours(key, { ...hours, close: e.target.value })}
                            className="rounded-md border bg-background px-2 py-1 text-sm"
                          />
                        </>
                      ) : (
                        <span className="text-muted-foreground">Closed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Cookie / consent notice</p>
                <p className="text-xs text-muted-foreground">A small dismissible strip shown the first time the widget opens.</p>
              </div>
              <Switch checked={consentEnabled} onCheckedChange={setConsentEnabled} />
            </div>
            {consentEnabled && (
              <Textarea
                value={consentText}
                onChange={(e) => setConsentText(e.target.value)}
                placeholder="This chat may use cookies to remember your conversation. By continuing, you agree to our Privacy Policy."
                rows={2}
              />
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {saved && <p className="text-sm text-emerald-600">Saved.</p>}
          <Button type="submit" disabled={saving} className="w-fit">
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </form>
      </CardContent>
      <CardContent className="border-t pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-destructive">Delete this bot</p>
            <p className="text-xs text-muted-foreground">Removes all knowledge sources, chunks, and conversations.</p>
          </div>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete bot"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
