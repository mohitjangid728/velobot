import type { Bot } from "@velobot/shared";

/**
 * Checks the request's Origin (falling back to Referer) against the bot's
 * allowed_domains allowlist. An empty allowlist blocks all embeds — bot
 * admins must explicitly add at least one domain, which prevents a
 * newly-created bot from being embeddable everywhere by default.
 */
export function isOriginAllowed(bot: Pick<Bot, "allowed_domains">, req: Request): boolean {
  const originHeader = req.headers.get("origin") ?? req.headers.get("referer");
  if (!originHeader) return false;
  if (!bot.allowed_domains || bot.allowed_domains.length === 0) return false;

  let hostname: string;
  try {
    hostname = new URL(originHeader).hostname;
  } catch {
    return false;
  }

  return bot.allowed_domains.some((allowed) => {
    const cleaned = allowed.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return hostname === cleaned || hostname.endsWith(`.${cleaned}`);
  });
}

/**
 * CORS headers for a widget-facing response. `allowed` must come from an
 * actual isOriginAllowed(bot, req) check — this function never guesses at
 * it. When `allowed` is false, Access-Control-Allow-Origin is omitted
 * entirely, so the browser blocks the calling page's JS from reading the
 * response body at all — not just from seeing a 403 with a real error
 * message. That's what makes allowed_domains an actual CORS boundary
 * rather than only an application-level check a disallowed origin could
 * still read the result of.
 *
 * For CORS preflight (OPTIONS) on POST routes, the bot_id lives in the
 * JSON body, which browsers never send with a preflight request — there's
 * no way to look up the whitelist yet at that point. Preflight responses
 * are therefore always permissive (pass `allowed: true`); this leaks
 * nothing, since a preflight carries no actual data — enforcement happens
 * on the real GET/POST response once the bot (and its allowed_domains)
 * are known.
 */
export function corsHeaders(req: Request, allowed: boolean): HeadersInit {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
  if (allowed && origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}
