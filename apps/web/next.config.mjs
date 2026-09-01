import { withSentryConfig } from "@sentry/nextjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Needed so Next's file tracer picks up @velobot/shared from the pnpm
  // workspace root instead of assuming apps/web is the whole repo.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@velobot/shared"],
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "mammoth"],
    instrumentationHook: true,
  },
  // CORS for widget-facing routes is set per-route by lib/security/origin.ts's
  // corsHeaders() (see app/api/widget-config, app/api/chat/*) — intentionally
  // not duplicated here, since Next.js would send both and browsers reject a
  // response carrying two Access-Control-Allow-Origin values.
};

// withSentryConfig only uploads source maps / wraps build output when
// SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT are set (build-time, CI
// concern) — with none of those set, this wrapper is a no-op pass-through,
// same as Sentry.init() being a no-op at runtime without a DSN. See
// sentry.{client,server,edge}.config.ts for the runtime side.
export default withSentryConfig(nextConfig, {
  silent: true,
});
