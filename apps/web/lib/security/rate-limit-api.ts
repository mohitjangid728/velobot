import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let limiter: Ratelimit | null = null;

// Same placeholder-detection as lib/security/rate-limit.ts — kept as a
// separate copy rather than a shared helper since the two call sites
// (chat vs. the public developer API) intentionally never need to change
// in lockstep.
function isConfigured(value: string | undefined): value is string {
  return !!value && !value.includes("your-redis") && !value.includes("your-upstash-token");
}

function getLimiter(): Ratelimit | null {
  if (!isConfigured(process.env.UPSTASH_REDIS_REST_URL) || !isConfigured(process.env.UPSTASH_REDIS_REST_TOKEN)) {
    return null;
  }
  if (!limiter) {
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(100, "60 s"),
      prefix: "velobot:api",
    });
  }
  return limiter;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Sliding-window rate limit for the public Developer API (see
 * app/api/v1/*), keyed by API key id rather than ip:botId — a single
 * integration hammering the API shouldn't be able to affect another org's
 * key at all, since they're never in the same bucket. Same fail-open
 * behavior as lib/security/rate-limit.ts when Upstash isn't configured.
 */
export async function checkApiRateLimit(apiKeyId: string): Promise<RateLimitResult> {
  const rl = getLimiter();
  if (!rl) {
    console.warn("[rate-limit-api] Upstash not configured; API requests are NOT rate-limited.");
    return { allowed: true, remaining: Infinity };
  }
  try {
    const { success, remaining } = await rl.limit(apiKeyId);
    return { allowed: success, remaining };
  } catch (err) {
    console.error("[rate-limit-api] Upstash call failed; failing open.", err);
    return { allowed: true, remaining: Infinity };
  }
}
