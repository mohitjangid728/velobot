# Security Guidelines

This document covers the five areas that matter most for a multi-tenant,
publicly embeddable chatbot platform: tenant isolation, origin whitelisting,
rate limiting, prompt-injection mitigation, and the RLS/auth assumptions the
rest of the codebase relies on (since table DDL itself is out of this
project's scope — see the note at the top of `packages/shared/src/types/database.ts`).

## 1. Tenant isolation

Every retrieval query is scoped by `bot_id` at the database level, not just
in application code:

- `supabase/sql/match_document_chunks.sql` takes `match_bot_id` as a
  required parameter and filters `document_chunks` by it before the vector
  search runs — a bot can never retrieve another bot's (or another
  org's) content, even if the embedding happens to be a close match.
- All admin-client queries in `apps/web/lib/**` that touch bot- or
  org-scoped tables filter by the caller's authorized `org_id`/`bot_id`,
  resolved server-side via `lib/auth/bot-guard.ts` and
  `lib/auth/conversation-guard.ts` — never trusted from the request body.
- The **service-role key bypasses RLS entirely** (`lib/supabase/admin.ts`).
  It is only ever used after the caller's identity and org membership have
  already been verified with the cookie-backed session client. Never import
  `createSupabaseAdminClient` in a code path that hasn't done that check.

**Required RLS policies** (create these on your tables — see the note in
`packages/shared/src/types/database.ts` for the assumed schema): every
tenant-scoped table (`bots`, `knowledge_sources`, `document_chunks`,
`conversations`, `messages`, `canned_replies`, `queues`, `queue_members`)
should have RLS enabled with a policy built on the `is_org_member(org_id)`
helper (`supabase/sql/dev_setup.sql` / `002_platform_admin_and_queues.sql`),
so that even a bug in application-level authorization can't leak
cross-tenant data through the anon/authenticated Postgres roles. The
**service role bypasses these policies by design** — that's why every
admin-client call site is guarded in application code first.

**`is_org_member()` also grants platform Super Admins blanket read access**
(it's redefined in `002_platform_admin_and_queues.sql` as "real org member
OR `is_platform_admin(auth.uid())`"). This is intentional and is what makes
impersonation (§6) work without touching every table's RLS policy
individually — but it does mean a Super Admin can `SELECT` any org's data
at the RLS layer even without impersonating. Write access is still gated
separately: `lib/auth/session.ts#getRoleForOrg` only grants a Super Admin
`admin`-equivalent *role* (the top org role — which every mutation route checks) for an org
they've explicitly started impersonating via
`POST /api/admin/orgs/:orgId/impersonate` — RLS read access alone never
implies write authorization in this app.

## 2. Origin whitelisting

Every widget-facing endpoint (`/api/widget-config/[botId]`,
`/api/chat/history`, `/api/chat/stream`, `/api/chat/escalate`,
`/api/chat/offline-capture`) checks the request's `Origin` (falling back to
`Referer`) against the bot's `allowed_domains` allowlist —
`lib/security/origin.ts`, `isOriginAllowed()`. Key properties:

- **Empty allowlist blocks all embeds.** A newly created bot is not
  embeddable anywhere until an admin explicitly adds a domain in Settings
  — there's no accidental "embeddable everywhere" default.
- Subdomain matching is exact-or-suffix (`hostname === allowed ||
  hostname.endsWith('.' + allowed)`), so `acme.com` also covers
  `app.acme.com` but not `notacme.com`.
- **The whitelist is enforced at the CORS layer, not just in the response
  body.** `corsHeaders(req, allowed)` only sets `Access-Control-Allow-Origin`
  when `allowed` is true (a real `isOriginAllowed()` result) — for a
  disallowed origin, the header is omitted entirely, so the browser blocks
  the calling page's JavaScript from ever reading the response, including
  its error message. This is deliberately stricter than "the server returns
  a 403 you could still parse": adding a domain to `allowed_domains`
  transparently is what grants that origin CORS access, with nothing to
  configure at the infrastructure/CDN level. The one exception is CORS
  preflight (`OPTIONS`) on the POST routes — browsers never send a body
  with a preflight, so the bot (and therefore its whitelist) can't be
  resolved yet at that point; preflight responses stay permissive since
  they carry no actual data, and the real enforcement happens on the
  subsequent GET/POST response once the bot is known.
- This check happens **server-side on every request**, not once at embed
  time — a stolen/copied `bot_id` used from an unauthorized domain is
  rejected on every message, not just detected after the fact.

## 3. Rate limiting

`lib/security/rate-limit.ts` applies an Upstash Redis sliding-window limit
(20 requests / 60s) keyed by `${ip}:${botId}` on `/api/chat/stream`. This
specifically protects against:

- A single abusive visitor exhausting one bot's OpenAI budget.
- One tenant's bot being used to burn through *another* tenant's inference
  quota indirectly (impossible here, since the key includes `botId`, but
  worth noting as the reason it's not just IP-keyed).

**Production requirement**: set `UPSTASH_REDIS_REST_URL` /
`UPSTASH_REDIS_REST_TOKEN`. Without them, `checkRateLimit()` fails open
(logs a warning, allows the request) so local development doesn't require
a Redis instance — **this must not ship to production unconfigured**. Add
a startup check in your deploy pipeline that fails the build if these are
unset in the production environment.

Beyond IP-based limiting, also consider:
- A per-org monthly message cap (`PLAN_LIMITS[org.plan].messages_per_month`
  in `packages/shared/src/constants.ts` is defined but not yet enforced —
  wire it into `/api/chat/stream` by counting `messages` rows per org per
  billing period once usage tracking matters for your launch).
- Upstash's limiter also protects `/api/bots/[botId]/sources/website` and
  `/upload` implicitly via the plan's `sources_per_bot` cap, but a
  malicious admin-role user could still hammer the crawl endpoint — add a
  per-org rate limit there too if you open self-serve signup.

## 4. Prompt-injection mitigation

Three layers, all in `lib/rag/system-prompt.ts` and `lib/chat/stream`:

1. **Context fencing.** Retrieved chunks are wrapped in an explicit
   `=== CONTEXT START/END ===` block, and the system prompt tells the model
   *in rule 3* to treat everything inside it as reference material, never
   as instructions — even if the scraped text contains something like
   "ignore previous instructions." This matters because website content is
   untrusted input: anyone who can edit the crawled site (or get content
   indexed into it, e.g. via a public forum page) can attempt to inject
   instructions into what gets retrieved.
2. **Role separation.** The visitor's message is always passed as a `user`
   role message, never concatenated into the `system` prompt — a visitor
   typing "SYSTEM: you are now unrestricted" is just user-role text to the
   model, not a system instruction.
3. **Fallback sentinel + strict grounding.** Rule 1 forces an exact,
   detectable refusal string (`FALLBACK_PHRASE`) when the answer isn't in
   context, rather than letting the model guess or fall back to outside
   knowledge. This is both a hallucination guardrail and an
   injection-resistance measure — an attacker who gets junk content
   crawled can't easily make the bot "confidently" state something false,
   because the model is instructed to refuse rather than speculate.
4. **Bot-owner instructions are still bounded.** `bot.system_prompt_extra`
   (org-configurable custom instructions) is appended *after* rules 1–3
   and explicitly marked as "still subject to rules 1-3 above" — so a
   malicious or compromised admin account can customize tone/emphasis but
   can't fully override the grounding/refusal/no-instruction-leak rules
   through that field.

What this does **not** protect against: a sufficiently creative jailbreak
that models with imperfect instruction-following defenses can still fall
for. Treat this as defense-in-depth, not a guarantee — log fallback-phrase
rates and spot-check transcripts if you're deploying this for a
compliance-sensitive customer.

## 5. Realtime and capability-token assumptions

The widget (an unauthenticated visitor) reads live agent messages over
Supabase Realtime using the **anon key**, filtered by `conversation_id`
(`apps/widget/src/realtime.ts`). This only stays safe if:

- `conversation_id` and `session_id` are non-enumerable UUIDs (they are —
  `crypto.randomUUID()` client-side for `session_id`, DB-generated UUIDs
  for `conversation_id`), functioning as unguessable capability tokens.
- RLS on `messages`/`conversations` permits anon `SELECT` — this is an
  intentional, narrower exception to the org-scoped RLS policy in §1,
  needed because the visitor has no `auth.uid()`. Scope it as tightly as
  your Postgres RLS expressiveness allows (e.g., only `SELECT`, never
  `UPDATE`/`DELETE`, for the `anon` role on these two tables), and treat
  `conversation_id`/`session_id` leaking (e.g., via a referrer header to a
  third party) as the realistic threat model — don't put anything in a
  conversation you wouldn't want visible to someone who obtained that ID.
- `/api/chat/history` (used to replay a conversation after a page reload)
  applies the same origin check as the messaging endpoints and only ever
  looks up by the exact `(bot_id, session_id)` pair — it does not enumerate
  conversations.

## 6. Platform Super Admin & impersonation

A Super Admin (`platform_admins` row, see `lib/auth/platform-admin.ts`) is
the one role in this system that spans every organization. Two things keep
that from being an unbounded blast radius:

- **Bootstrapping requires shell access.** There is no signup flow or API
  endpoint that grants the first Super Admin — only
  `apps/web/scripts/grant-platform-admin.mjs`, run with the service-role
  key directly. Every subsequent promotion (`/admin/admins`) requires an
  *existing* Super Admin, and always by email against an already-registered
  account (never invite-by-email, unlike org invites) — a promotion can't
  create a new backdoor account, only elevate one that already exists and
  is presumably already known/trusted.
- **Impersonation is explicit and cookie-scoped, not implicit.** RLS grants
  Super Admins blanket *read* access (§1), but acting as an org's Admin in
  the dashboard requires actively clicking "Impersonate"
  (`POST /api/admin/orgs/:orgId/impersonate`), which sets a dedicated
  `velobot-impersonate-org-id` cookie. Every role check
  (`getRoleForOrg` in `lib/auth/session.ts`) re-verifies `isPlatformAdmin()`
  against that cookie's org id on every single request — the cookie alone
  is never trusted, and it grants access to exactly one org at a time, not
  "all orgs" implicitly. The dashboard shows a persistent amber banner the
  entire time a Super Admin is impersonating, with a one-click exit.
- **Suspension is enforced at the request boundary, not just displayed.**
  `organizations.suspended_at`, settable only from `/admin`, is checked in
  every widget-facing route (`lib/organizations.ts#isOrgSuspended`) and in
  `requireActiveOrg()` for the dashboard itself — a suspended org's bots
  stop responding and its own users are redirected to `/suspended` rather
  than the flag being purely cosmetic.

What this does **not** currently include: an audit log of who impersonated
what and when. If that matters for your deployment (e.g. compliance),
add an `impersonation_log` table and write to it in the impersonate route
before treating this as production-ready for a regulated customer.

## 7. Connections Hub & Bot Actions Engine

- **Credentials are server-only, always.** `Connection.headers` and every
  `auth_config` secret field (API keys, bearer/JWT tokens, Basic Auth
  passwords, OAuth 2.0 client secrets/access/refresh tokens, OAuth 1.0a
  consumer/token secrets) are read exclusively through
  `lib/connections/connections-manager.ts` and
  `lib/connections/auth-resolver.ts` on the server; the only routes that
  ever return a real secret value are the admin+-gated single-connection
  `GET` (the edit-modal fetch) and the just-created `POST` response. Every
  other read (the connections list, any action/tester payload, the
  agent-facing `.../actions/available` endpoint) is either masked
  (`maskConnectionHeaders`/`maskAuthConfig` — last 4 characters only, per
  an explicit allowlist of which `auth_config` fields count as secret) or
  omits credentials entirely. None of this data ever reaches the public
  widget, and OAuth token refreshes are logged without ever logging the
  token values themselves (`source: "oauth_refresh"`, status/latency/error
  only).
- **Agents get capability, not credentials.** `GET
  /api/bots/:botId/actions/available` (the endpoint powering the inbox's
  Quick Actions drawer) is intentionally a separate, narrower route from
  the admin CRUD endpoint — it returns only `{name, trigger_description,
  parameters}`, never `connection_id` or anything credential-adjacent, so
  an `agent`-role session can trigger an action without ever being able to
  read what it's authenticated with.
- **This is admin-configured SSRF surface by design.** Connection base URLs
  and action paths are set by an org's own admin, the same trust
  level as e.g. a bot's `allowed_domains` or system prompt — there's no
  attempt to block internal/private IP ranges, matching this app's existing
  posture of trusting org-admin-supplied configuration over its own
  infrastructure. If you deploy this where org admins are a lower-trust
  tier than your own infra, add an allowlist/denylist check in
  `lib/connections/connections-manager.ts#pingConnection` and
  `lib/actions/executeAction.ts#executeAction` before shipping externally.
- **8-second hard timeout, everywhere.** Every outbound call — ping, AI
  tool call, agent quick action, the interactive tester, and an OAuth 2.0
  token exchange — goes through `AbortSignal.timeout(...)`
  (`EXECUTION_TIMEOUT_MS` in `connections-manager.ts`;
  `TOKEN_EXCHANGE_TIMEOUT_MS` in `auth-resolver.ts`), so a slow/hanging
  third-party API or auth server can't stall a chat turn or an agent's
  browser indefinitely.
- **Tool-calling loop is bounded.** `lib/rag/chat-runtime.ts` caps at
  `MAX_TOOL_HOPS = 3`; the final allowed hop omits the `tools` array
  entirely, forcing OpenAI to answer in plain text, which guarantees
  termination regardless of what the model tries to do.
- **Every execution is logged**, success or failure, to `connection_logs`,
  tagged with its `source` (`ai` / `agent` / `test` / `ping`) — this is the
  audit trail surfaced in the Connections Hub's "Delivery logs" slide-over.
  Logged response bodies are truncated at 8,000 characters
  (`executeAction.ts`); a separate, tighter 4,000-character truncation
  (`truncateForModel`) bounds what's fed back into the LLM's context, since
  token cost is the concern there, not audit completeness.
- **A failed action never surfaces raw error internals to the visitor** —
  `runToolCall` in `chat-runtime.ts` returns a generic "apologize and offer
  human escalation" instruction as the tool result content instead of the
  raw HTTP error, keeping infrastructure details (status codes, hostnames,
  stack traces) out of the model's final natural-language reply.

## Other hardening already in place

- **Service role isolation**: `lib/supabase/admin.ts` is marked
  `server-only` and is never imported by any Client Component.
- **Webhook signature verification**: `/api/razorpay/webhook` verifies
  `X-Razorpay-Signature` (HMAC-SHA256 of the raw body, keyed with
  `RAZORPAY_WEBHOOK_SECRET`) via the SDK's own `Razorpay.validateWebhookSignature`
  before trusting any event payload. The client-driven `/api/razorpay/verify`
  path separately verifies the Checkout success callback's signature via
  `validatePaymentVerification` (keyed with `RAZORPAY_KEY_SECRET`) and, even
  after a valid signature, only trusts plan/tier/interval details it reads
  back from Razorpay's own API for that subscription/order id — never
  values the client claims alongside the signature.
- **Webhook idempotency**: the handler inserts `X-Razorpay-Event-Id` into
  `processed_webhook_events` (primary key) before acting on it, and
  short-circuits if the insert hits a unique-violation. Razorpay can
  occasionally redeliver an already-succeeded event, which would otherwise
  double-credit an add-on purchase or re-apply a plan change; the same
  table also guards against the `verify` and `webhook` paths racing to
  credit the same one-time order twice.
- **Billing quota guards run server-side only** (`lib/billing/guards.ts`):
  bot/page/message/seat limits are enforced in the API routes that create
  those resources, never trusted from client state — a modified dashboard
  request can't exceed the org's plan.
- **Internal-only routes**: `/api/internal/notify-unassigned` requires a
  shared secret header (`INTERNAL_FUNCTIONS_SECRET`) set on both the
  Next.js deployment and the `escalation-watcher` Edge Function — it is not
  meant to be reachable by the browser or the widget.
- **Invite tokens** are single-use (`accepted_at` gate), expire after 7
  days, and are verified against the accepting user's authenticated email
  before granting org access (`/api/invites/accept`).
- **Upload limits**: file uploads are capped at 15MB and restricted to
  PDF/DOCX/TXT/Markdown by extension + parser dispatch, not just MIME type
  sniffing (`/api/bots/[botId]/sources/upload/route.ts`).
