import { format } from "date-fns";
import { Sparkles, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DailyVolume, DeflectionRate, SentimentBreakdown, TopIntent } from "@/lib/analysis/dashboard-metrics";

function VolumeChart({ data }: { data: DailyVolume[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex h-24 items-end gap-1">
      {data.map((d) => (
        <div key={d.date} className="group relative flex flex-1 flex-col items-center justify-end" title={`${format(new Date(d.date), "MMM d")}: ${d.count}`}>
          <div
            className="w-full rounded-t bg-primary/70 transition-colors group-hover:bg-primary"
            style={{ height: `${Math.max(3, (d.count / max) * 100)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

const SENTIMENT_TONE: Record<keyof SentimentBreakdown, string> = {
  positive: "bg-status-good",
  neutral: "bg-muted-foreground/40",
  negative: "bg-status-critical",
};

function SentimentBar({ breakdown }: { breakdown: SentimentBreakdown }) {
  const total = breakdown.positive + breakdown.neutral + breakdown.negative;
  if (total === 0) return <p className="text-sm text-muted-foreground">Not enough data yet.</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-secondary">
        {(["positive", "neutral", "negative"] as const).map(
          (key) => breakdown[key] > 0 && <div key={key} className={SENTIMENT_TONE[key]} style={{ width: `${(breakdown[key] / total) * 100}%` }} />
        )}
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground">
        {(["positive", "neutral", "negative"] as const).map((key) => (
          <span key={key} className="flex items-center gap-1.5 capitalize">
            <span className={`h-2 w-2 rounded-full ${SENTIMENT_TONE[key]}`} /> {key} ({breakdown[key]})
          </span>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsPanel({
  volume,
  deflection,
  sentiment,
  topIntents,
  averageRating,
}: {
  volume: DailyVolume[];
  deflection: DeflectionRate;
  sentiment: SentimentBreakdown;
  topIntents: TopIntent[];
  averageRating: { average: number; count: number } | null;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Conversation volume</CardTitle>
          <CardDescription>Last {volume.length} days, across all your bots</CardDescription>
        </CardHeader>
        <CardContent>
          <VolumeChart data={volume} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI deflection</CardTitle>
          <CardDescription>Resolved conversations that never needed a human</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold tabular-nums">{Math.round(deflection.rate * 100)}%</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {deflection.resolvedByAi} by AI · {deflection.resolvedByHuman} escalated
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-base">
            <Sparkles className="h-4 w-4 text-muted-foreground" /> Visitor sentiment
          </CardTitle>
          <CardDescription>AI-detected hint, not verified</CardDescription>
        </CardHeader>
        <CardContent>
          <SentimentBar breakdown={sentiment} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top intents</CardTitle>
          <CardDescription>AI-detected hint, not verified</CardDescription>
        </CardHeader>
        <CardContent>
          {topIntents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not enough data yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {topIntents.map((t) => (
                <Badge key={t.intent} variant="outline">
                  {t.intent} · {t.count}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-base">
            <Star className="h-4 w-4 text-muted-foreground" /> Visitor rating
          </CardTitle>
          <CardDescription>From the post-chat rating prompt</CardDescription>
        </CardHeader>
        <CardContent>
          {averageRating ? (
            <>
              <p className="text-3xl font-bold tabular-nums">{averageRating.average.toFixed(1)} / 5</p>
              <p className="mt-1 text-xs text-muted-foreground">{averageRating.count} rating{averageRating.count === 1 ? "" : "s"}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No ratings submitted yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
