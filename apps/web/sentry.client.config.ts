import * as Sentry from "@sentry/nextjs";

// An empty/undefined dsn puts the SDK in a fully disabled no-op state
// (logged at debug level, nothing is ever sent) — this file is safe to
// ship before an account admin has a Sentry project to point at.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
});
