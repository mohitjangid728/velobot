import "server-only";

/**
 * Server-side capture for events posthog-js (browser-only) can't see — a
 * plain fetch against PostHog's HTTP capture API rather than pulling in
 * posthog-node as a second SDK for the one event that needs it. Same
 * public key as the client SDK (NEXT_PUBLIC_POSTHOG_KEY) — PostHog's
 * ingestion endpoint is designed to accept it from either side. No-ops
 * without a configured key, same as the client wrapper.
 */
export function trackServerEvent(distinctId: string, event: string, properties?: Record<string, unknown>): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
  fetch(`${host}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: key, event, distinct_id: distinctId, properties }),
  }).catch(() => {
    // Analytics must never affect the request it's attached to.
  });
}
