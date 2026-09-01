import * as Sentry from "@sentry/nextjs";

// Used by every edge-runtime route, notably app/api/chat/stream/route.ts —
// the highest-traffic, previously-unmonitored path in the app.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});
