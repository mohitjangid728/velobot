# VeloBot

A multi-tenant AI chatbot SaaS platform: businesses train a support bot on
their own website/docs, embed it via one script tag, and escalate
conversations to a live agent inbox with team RBAC. A Connections Hub &
Bot Actions Engine (`/dashboard/settings/connections` and
`/dashboard/settings/actions` — both workspace-scoped, so one action can be
linked to several bots) lets bots and agents call external APIs — lead
capture, order/ticket lookups, appointment booking — as OpenAI tool calls
or one-click agent actions; see `docs/API.md` and `docs/SECURITY.md` §7.

## Stack

- **Portal**: Next.js 14 (App Router) · TypeScript · Tailwind · shadcn/ui · Lucide
- **Backend**: Supabase (Auth, Postgres + pgvector, Realtime, Storage), Razorpay, Upstash Redis, Resend
- **AI**: OpenAI `text-embedding-3-small` + `gpt-4o-mini`
- **Widget**: Vanilla TS, Vite (IIFE build), Shadow DOM
- **Testing/CI**: Vitest (`packages/shared`, `apps/web`) + GitHub Actions (`.github/workflows/ci.yml`)
- **Observability (optional)**: Sentry (error monitoring) and PostHog (product analytics) — both fully inert until their env vars are set, see `.env.example`

## Directory structure

```
veloBot/
├── apps/
│   ├── web/                 # Next.js portal — dashboard, inbox, all API routes
│   │   ├── app/
│   │   │   ├── (auth)/              # login, signup, accept-invite
│   │   │   ├── onboarding/          # first-org creation
│   │   │   ├── (dashboard)/         # sidebar-shell CRUD screens (bots, team, settings)
│   │   │   ├── (inbox)/inbox/       # dedicated 3-panel live agent inbox
│   │   │   └── api/                 # all Route Handlers — see docs/API.md
│   │   ├── components/{ui,dashboard,inbox,shared}/
│   │   ├── lib/{auth,supabase,ingestion,rag,security,notifications,razorpay}/
│   │   └── hooks/
│   └── widget/               # Standalone embeddable widget (Vite → dist/widget.js)
│       └── src/{ui,*.ts}
├── packages/
│   └── shared/                # Row types, zod DTOs, shared constants — imported by apps/web only.
│                               #   apps/widget deliberately does NOT depend on it (its own src/types.ts
│                               #   mirrors the handful of fields it needs) so the widget bundle never
│                               #   pulls in zod or anything not required for a minimal embed script.
├── supabase/
│   ├── sql/                   # match_document_chunks.sql (shipped) + dev_setup.sql /
│   │                          #   002_platform_admin_and_queues.sql (dev/test setup aids)
│   └── functions/              # escalation-watcher (Deno Edge Function)
├── docs/
│   ├── API.md
│   └── SECURITY.md
└── .env.example
```

**Database schema is intentionally out of scope for this codebase** — see
the header comment in `packages/shared/src/types/database.ts` for the exact
tables/columns every query assumes, and `supabase/sql/match_document_chunks.sql`
for the one SQL function this project does ship (retrieval, not schema).

## Setup

1. **Supabase project**: enable the `pgvector` extension, create the tables
   described in `packages/shared/src/types/database.ts` with RLS per
   `docs/SECURITY.md` §1 and §5, then run `supabase/sql/match_document_chunks.sql`.
   For local dev/testing, `supabase/sql/dev_setup.sql` does all of the above
   in one script — run it, then run
   `supabase/sql/002_platform_admin_and_queues.sql` (adds Super Admin +
   Queues support), `supabase/sql/003_billing.sql` (adds the
   multi-tier plan/add-on billing columns — see `packages/shared/src/plans.ts`
   for the tier/quota/pricing source of truth), and
   `supabase/sql/004_connections_actions_auth.sql` (adds the Connections
   Hub, Bot Actions Engine, and the auth-standards layer — API Key,
   Bearer, Basic, JWT, OAuth 2.0 with auto-refresh, OAuth 1.0a), then run
   `005` through `010` in order (`005_admin_audit_log.sql`,
   `006_admin_roles_and_notes.sql`, `007_remove_owner_role.sql`,
   `008_guardrails_llm_workflow_extraction.sql`,
   `009_launch_readiness.sql` — this one also needs a
   `conversation-attachments` Storage bucket created manually in the
   Supabase dashboard, per the comment at the bottom of that file —
   and `010_razorpay_billing.sql`), then `match_document_chunks.sql`.
2. **Install deps** (requires `pnpm`; `corepack enable` if you don't have it):
   ```bash
   pnpm install
   ```
3. **Environment**: copy `.env.example` to `.env` at the repo root (used by
   `apps/web` via Turborepo's env passthrough) and `apps/widget/.env.example`
   to `apps/widget/.env`. Fill in Supabase, OpenAI, Razorpay, Upstash, and
   Resend credentials.
4. **Run the portal**:
   ```bash
   pnpm dev:web        # http://localhost:3000
   ```
5. **Build the widget**:
   ```bash
   pnpm --filter @velobot/widget build
   # serve apps/widget/dist/widget.js from your CDN, or open
   # apps/widget/test.html locally against a `vite preview`/static server
   ```
6. **Escalation alerts**: deploy `supabase/functions/escalation-watcher`
   (`supabase functions deploy escalation-watcher`), set its secrets
   (`APP_URL`, `INTERNAL_FUNCTIONS_SECRET`, plus the Supabase-provided
   `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`), and schedule it every ~30s
   via `pg_cron` + `pg_net` (example command in the function's header
   comment).
7. **Razorpay webhook**: point a webhook endpoint at `/api/razorpay/webhook`
   for `subscription.activated`, `subscription.charged`,
   `subscription.cancelled`, `subscription.completed`, `subscription.halted`,
   `payment.failed`, and `order.paid`, and set `RAZORPAY_WEBHOOK_SECRET`.
   Create one Razorpay Plan per tier/interval/currency plus the seat add-on
   — run `node scripts/create-razorpay-plans.mjs` from `apps/web` to create
   them via the API and print the `.env` block (see `lib/razorpay/plan-map.ts`)
   — and set `NEXT_PUBLIC_RAZORPAY_KEY_ID` for the Checkout.js popup used
   on `/pricing` and the dashboard billing page.
8. **Bootstrap a Super Admin** (optional — only needed to use `/admin`):
   there's no UI path to create the first one. Sign up normally, then from
   `apps/web`: `node --env-file=.env.local scripts/grant-platform-admin.mjs you@example.com`.
   Once at least one exists, further promotion can happen from `/admin/admins`.
   `scripts/seed-test-accounts.mjs` similarly seeds two quick-login dev
   accounts (Owner + Admin) shown on the login page outside production
   builds.

## Manual smoke test

1. Sign up → create a workspace (you're its Owner).
2. Create a bot, add a knowledge source (crawl a small site or upload a
   PDF) under **Sources**, wait for status `ready`.
3. Set **Settings → Allowed embed domains** to include wherever you're
   testing from (e.g. `localhost`).
4. Copy the embed snippet from the **Embed** tab into
   `apps/widget/test.html`'s `data-bot-id`, build the widget, and open the
   test page — ask it a question grounded in your source content and
   confirm the response streams token-by-token.
5. Click **Talk to a human** in the widget.
6. In a second browser session, invite a teammate as **Agent** from
   **Team**, accept the invite, and open `/inbox` — the ticket should
   appear under **Unassigned** with a chime, get claimed, and messages sent
   from the inbox should appear live in the widget.
7. Click **Resolve** — the widget's banner should clear and a new message
   should re-engage the AI.
8. Optional: create a queue under **Queues**, add one agent to it, assign
   it to a bot under that bot's Settings tab — escalations for that bot now
   only chime/appear as "Unassigned" for that queue's members (admins/owners
   still see everything). Optional: as a Super Admin, visit `/admin`,
   suspend the workspace, and confirm the widget stops responding
   (403 from `/api/widget-config`) until reactivated.

## What's deliberately not included

- **Database DDL** (tables, RLS policy SQL) — by design, see above. The one
  exception is the retrieval RPC function.
- A background job queue for ingestion — `/api/bots/:botId/sources/website`
  runs the crawl synchronously within the request (capped at 300s via
  `maxDuration`). For very large sites, swap this for a queue
  (e.g. Supabase Queues, Trigger.dev) without changing
  `lib/ingestion/ingest-source.ts`, which is already decoupled from the
  route handler that calls it.
