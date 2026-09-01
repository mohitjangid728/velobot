"use client";

import posthog from "posthog-js";

let initialized = false;

/** Explicit guard rather than relying on posthog-js to no-op cleanly — unlike Sentry, capture() calls before init() can throw. Call once, e.g. from a root-layout client component. */
export function initPosthog(): void {
  if (initialized || typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    capture_pageview: true,
    person_profiles: "identified_only",
  });
  initialized = true;
}

/** No-ops before initPosthog() has run (or when no key is configured) rather than throwing — every call site should be able to fire-and-forget this without an `if` guard of its own. */
export function trackEvent(name: string, properties?: Record<string, unknown>): void {
  if (!initialized) return;
  posthog.capture(name, properties);
}
