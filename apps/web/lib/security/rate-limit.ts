import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let limiter: Ratelimit | null = null;

// .env.example ships non-empty placeholder values (e.g.
// "https://your-redis.upstash.io") so the file is self-documenting — an
// unset-vs-empty check alone would treat that placeholder as "configured"
// and then hard-fail when the SDK actually tries to reach it. Recognize
// the placeholder shape explicitly instead.
function isConfigured(value: string | undefined): value is string {
  return !!value && !value.includes("your-redis") && !value.includes("your-upstash-token");
}

function getLimiter(): Ratelimit | null {
  if (!isConfigured(process.env.UPSTASH_REDIS_REST_URL) || !isConfigured(process.env.UPSTASH_REDIS_REST_TOKEN)) {
    return null; // no Redis configured — see docs/SECURITY.md for the dev-only fallback behavior
  }
  if (!limiter) {
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(20, "60 s"),
      prefix: "velobot:chat",
    });
  }
  return limiter;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Sliding-window rate limit keyed by `ip:botId`, so one visitor spamming a
 * widget can't exhaust another bot's OpenAI budget. Fails open (with a
 * console warning) when Upstash isn't configured, so local dev without
 * Redis still works — production deployments must set the env vars.
 */
export async function checkRateLimit(ip: string, botId: string): Promise<RateLimitResult> {
  const rl = getLimiter();
  if (!rl) {
    console.warn("[rate-limit] Upstash not configured; requests are NOT rate-limited.");
    return { allowed: true, remaining: Infinity };
  }
  try {
    const { success, remaining } = await rl.limit(`${ip}:${botId}`);
    return { allowed: success, remaining };
  } catch (err) {
    // A Redis outage shouldn't take the whole chat endpoint down with it —
    // fail open and let the request through, same as "unconfigured".
    console.error("[rate-limit] Upstash call failed; failing open.", err);
    return { allowed: true, remaining: Infinity };
  }
}
