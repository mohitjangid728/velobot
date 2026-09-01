# API Specification

All routes live under `apps/web/app/api/**`. Three auth models are used:

- **Session-authenticated** (dashboard/inbox): cookie-based Supabase session,
  read via `lib/auth/session.ts`. Role is re-verified server-side on every
  request (`ROLE_RANK` comparison) — never trust a client-supplied role.
- **Widget-public**: no session. Authorized instead by
  (a) the bot's `allowed_domains` origin check and
  (b) an unguessable `session_id`/`conversation_id` acting as a capability
  token. See `docs/SECURITY.md` §2 and §5.
- **Platform Super Admin**: cookie-based session + a `platform_admins` row,
  checked via `lib/auth/platform-admin.ts`, independent of any org
  membership. See "Platform Super Admin" below.

Request/response bodies are validated with the zod schemas in
`packages/shared/src/dto.ts` — the schema names below match those exports.

## Organizations & RBAC

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/api/orgs` | session | `CreateOrgSchema` | Creates org + caller as `admin` (the top org role). Sets active-org cookie. |
| GET | `/api/orgs` | session | — | Lists caller's memberships. |
| PATCH | `/api/orgs/:orgId` | session, admin | `{ name }` | |
| DELETE | `/api/orgs/:orgId` | session, admin | — | Cascades (assumed FK `on delete cascade` on org-scoped tables). |
| POST | `/api/orgs/:orgId/switch` | session | — | Sets the active-org cookie. |
| GET | `/api/orgs/:orgId/invites` | session, admin+ | — | Members + pending invites. |
| POST | `/api/orgs/:orgId/invites` | session, admin+ | `InviteMemberSchema` | Enforces seat limit; sends Supabase admin invite email. |
| PATCH | `/api/orgs/:orgId/members/:memberId` | session, admin+ | `{ role }` | Cannot demote the last remaining admin. |
| DELETE | `/api/orgs/:orgId/members/:memberId` | session, admin+ | — | Cannot remove the last remaining admin. |
| POST | `/api/invites/accept` | session (post-magic-link) | `{ token }` | Links the authenticated user to the org per the invite. |

## Bots & knowledge sources

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/api/bots` | session, admin+ | `CreateBotSchema` | Enforces `PLANS[plan].quota.bots` (`lib/billing/guards.ts`). |
| PATCH | `/api/bots/:botId` | session, admin+ | `UpdateBotSchema` | Branding, `allowed_domains`, custom prompt, fallback toggle. |
| DELETE | `/api/bots/:botId` | session, admin | — | |
| POST | `/api/bots/:botId/sources/website` | session, admin+ | `IngestWebsiteSchema` | Synchronous: crawls, chunks, embeds, then returns. `maxDuration = 300`. |
| POST | `/api/bots/:botId/sources/upload` | session, admin+ | `multipart/form-data` (`file`) | PDF/DOCX/TXT/MD, ≤15MB. |
| DELETE | `/api/bots/:botId/sources/:sourceId` | session, admin+ | — | Deletes the source and its `document_chunks`. |
| POST | `/api/bots/:botId/test-chat` | session, admin+ | `TestChatRequestSchema` | **SSE.** In-dashboard "Test bot" panel — same retrieve + tool-calling pipeline as the widget (`lib/rag/chat-runtime.ts`), including real Bot Action execution, but not persisted to `conversations`/`messages`. |

`UpdateBotSchema` also accepts `queue_id` (uuid or `null`) — assigns which
queue's members escalations for this bot route to (see "Queues" below).

## Queues

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| GET | `/api/orgs/:orgId/queues` | session | — | Queues + their members for the org. |
| POST | `/api/orgs/:orgId/queues` | session, admin+ | `CreateQueueSchema` | |
| PATCH | `/api/orgs/:orgId/queues/:queueId` | session, admin+ | `UpdateQueueSchema` | Rename. |
| DELETE | `/api/orgs/:orgId/queues/:queueId` | session, admin+ | — | Bots pointing at it fall back to `queue_id: null` (any agent can claim) via `on delete set null`. |
| POST | `/api/orgs/:orgId/queues/:queueId/members/:userId` | session, admin+ | — | `userId` must already be an active org member. |
| DELETE | `/api/orgs/:orgId/queues/:queueId/members/:userId` | session, admin+ | — | |

## Connections Hub (workspace-scoped, shared across every bot in the org)

See `lib/connections/connections-manager.ts`. Header/credential values are
server-only — the list endpoint always returns them masked
(`maskConnectionHeaders`, which also masks `auth_config`'s secret fields via
`maskAuthConfig`); only the single-connection GET (edit-modal fetch)
returns real values, still admin+-gated.

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| GET / POST | `/api/orgs/:orgId/connections` | session, admin+ | `CreateConnectionSchema` (POST) | List is header/secret-masked; POST returns the real (just-created) values. |
| GET / PATCH / DELETE | `/api/orgs/:orgId/connections/:connectionId` | session, admin+ | `UpdateConnectionSchema` (PATCH) | GET is unmasked, for the edit modal. |
| POST | `/api/orgs/:orgId/connections/:connectionId/ping` | session, admin+ | — | Resolves the connection's real `auth_type` first (see below), then `HEAD` (falls back to `GET` on 405) against the base URL, 8s timeout. Always logged. |
| GET | `/api/orgs/:orgId/connections/:connectionId/logs` | session, admin+ | — | Paginated (`?cursor=`, cursor is the previous page's last `created_at`). |

### Connection auth types

A `Connection` has an `auth_type` (`custom_headers` \| `api_key` \|
`bearer_token` \| `basic_auth` \| `jwt` \| `oauth2` \| `oauth1`) and a
matching `auth_config`, validated as a zod discriminated union
(`ConnectionAuthConfigSchema` in `packages/shared/src/dto.ts`). `headers[]`
is always sent in addition to whichever `auth_type` resolves to — it's no
longer the only credential mechanism, just extra static headers (e.g. a
required `x-tenant-id`).

Every outbound request (AI tool call, agent quick action, the tester, and
ping) resolves auth through one shared function,
`resolveConnectionAuth()` in the new `lib/connections/auth-resolver.ts`:

- `api_key` / `bearer_token` / `basic_auth` / `jwt`: a plain computed
  header (or query param, for `api_key` with `location: "query"`).
- `oauth2`: `client_credentials` or `refresh_token` grant. Caches
  `access_token`/`expires_at` on the connection row and only re-hits
  `token_url` once the cached token is within 60s of expiry — the
  automatic-refresh behavior. A refresh attempt is logged with
  `source: "oauth_refresh"` (status/latency/error only — token values are
  never logged). Only Client Credentials and a bring-your-own Refresh
  Token are supported; there's no Authorization Code redirect/consent
  flow, since a Connection is a workspace-level system credential with no
  end-user session to redirect back to.
- `oauth1`: RFC 5849 HMAC-SHA1 request signing, computed fresh per request
  against the connection's stored consumer/token secrets — implemented
  with the Web Crypto API (`crypto.subtle`), not Node's `crypto` module,
  since this code path is reachable from the Edge-runtime
  `app/api/chat/stream/route.ts`.

Rows created before `auth_type` existed have neither field set and are
treated as `custom_headers` everywhere this is read — no migration
required for connections created before this feature shipped.

## Bot Actions Engine (workspace-scoped, like Connections — linkable to multiple bots)

See `lib/actions/actions-manager.ts` and `lib/actions/executeAction.ts`. An
action's `name` doubles as its OpenAI tool/function name
(`[a-zA-Z0-9_-]{1,64}`, unique per org). Actions live at
`/dashboard/settings/actions` (its own settings tab, next to Connections)
rather than inside a bot's page — the same action (e.g. `ticket_lookup`) can
be reused by several bots via `bot_action_links`, a many-to-many join
managed by the `bot_ids` field on `CreateActionSchema`/`UpdateActionSchema`
(full-replace semantics, same convention as `allowed_domains`).

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| GET / POST | `/api/orgs/:orgId/actions` | session, admin+ | `CreateActionSchema` (POST) | Full CRUD list, including drafts; each row includes a computed `bot_ids: string[]`. |
| GET / PATCH / DELETE | `/api/orgs/:orgId/actions/:actionId` | session, admin+ | `UpdateActionSchema` (PATCH) | |
| POST | `/api/orgs/:orgId/actions/:actionId/test` | session, admin+ | `RunActionSchema` | Interactive tester — runs the real HTTP call via `executeAction` (`source: "test"`) and returns the full result. |
| GET | `/api/bots/:botId/actions/available` | session, **agent**+ | — | Bot-scoped (resolved through `bot_action_links`), read-only, no connection/credential data — powers Agent Quick Actions in `/inbox`. Deliberately separate from the admin CRUD routes above. |

`POST /api/conversations/:id/actions/:actionId/execute` (session, agent+,
`lib/auth/conversation-guard.ts`) is the one-click dispatch from the inbox's
Quick Actions drawer: runs `executeAction` (`source: "agent"`) and inserts a
`role:"system"` message into that conversation summarizing the result.

## Chat (widget-public)

All of these check `isOriginAllowed()` against the bot's `allowed_domains`
and grant `Access-Control-Allow-Origin` **only** when it passes —
`corsHeaders(req, allowed)` omits the header entirely otherwise, so a
disallowed origin's browser can't read the response at all, not just get a
403 body it could still parse. See `docs/SECURITY.md` §2. They also all
403 if the bot's org is suspended (`lib/organizations.ts#isOrgSuspended`,
set by a Super Admin — see below).

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/widget-config/:botId` | — | Public branding + `agentsOnline`, plus `hideBranding`, `withinBusinessHours`, `consentBannerEnabled`/`consentBannerText`, and `locale`. No origin check (see SECURITY.md). |
| GET | `/api/chat/history?bot_id=&session_id=` | — | Replays a conversation after reload. |
| POST | `/api/chat/stream` | `ChatStreamRequestSchema` | **SSE** (`Content-Type: text/event-stream`). See event shapes below. |
| POST | `/api/chat/escalate` | `EscalateSchema` | Transitions `ai\|resolved → queued`, stamping `conversations.queue_id` from the bot's current `queue_id`. Returns `{ status, agentsOnline, conversationId }`. |
| POST | `/api/chat/offline-capture` | `OfflineEmailCaptureSchema` | Used when `agentsOnline` is false. Emails the org's earliest-added admin (or queue members, once escalated). |
| POST | `/api/chat/rating` | `SubmitRatingSchema` | Post-resolve CSAT (1-5 + optional comment), stored in `conversation_ratings`. No uniqueness enforced server-side — the widget's own `ratingSubmitted` session flag is what prevents re-prompting. |
| POST | `/api/chat/upload` | `multipart/form-data`: `bot_id`, `session_id`, `file` | Images/PDF only, 5MB max. Stores to the `conversation-attachments` Storage bucket and returns `{ url, type }` — the widget then sends that URL/type as `attachment_url`/`attachment_type` on the next `/api/chat/stream` call. |

### `/api/chat/stream` SSE events

```
event: meta        data: { "conversationId": "uuid" }
event: token        data: { "token": "partial text" }
event: tool_call    data: { "name": "ticket_lookup" }
event: tool_result  data: { "name": "ticket_lookup", "ok": boolean }
event: done          data: { "fallback": boolean }
event: human_mode  data: { "status": "queued" | "assigned" }
event: error         data: { "message": "..." }
```

`meta` is always sent first. If the conversation is already `queued` or
`assigned`, only `meta` + `human_mode` are sent (no AI tokens) — the client
is expected to already have (or now establish) a Supabase Realtime
subscription on that `conversationId` for the agent's reply.

`tool_call`/`tool_result` fire when the bot has active Bot Actions
(`lib/rag/chat-runtime.ts`) and the model invokes one mid-turn — they're
additive/optional for the client (today's widget ignores unknown SSE event
names), so this shipped with zero widget changes. A bot with no active
actions never triggers these; its request to OpenAI has no `tools` field at
all and behaves exactly as before this feature existed.

If the org has exhausted its plan's monthly AI message quota (and has no
add-on message balance left — see `lib/billing/guards.ts`
`assertCanSendAiMessage`), the stream sends `meta` then a single `token`
carrying a human-readable limit-reached message, then `done` — no OpenAI
call is made and no `error` event is used, so the widget renders it as a
normal bot reply rather than a broken state.

## Agent inbox (session-authenticated, `agent` role minimum)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/conversations/:id/messages` | — | Full thread. |
| POST | `/api/conversations/:id/messages` | `SendAgentMessageSchema` | 403 unless caller is the assigned agent (or admin+). |
| POST | `/api/conversations/:id/claim` | — | `queued → assigned`, atomic (`.eq('status','queued')` guard) — 409 if already claimed. |
| POST | `/api/conversations/:id/resolve` | — | `assigned → resolved`. Assigned agent or admin+. |
| POST | `/api/conversations/:id/read` | — | Clears `unread_by_agent` for the inbox badge. |
| GET / POST | `/api/canned-replies` | `CannedReplySchema` (POST) | Org-scoped quick-reply library. |

Real-time state (queue updates, live messages) is delivered via Supabase
Realtime `postgres_changes` subscriptions directly from the client — see
`hooks/use-agent-presence.ts` and `components/inbox/inbox-app.tsx` — not
polled through these REST routes.

**Queue-based access**: `requireConversationAccess` (`lib/auth/conversation-guard.ts`)
— the single guard every conversation route (`messages`, `claim`, `resolve`,
`execute-action`) goes through — rejects an agent acting on a conversation
whose `queue_id` isn't null (unrouted) and isn't one of the queues they're a
member of (`queue_members`). This is a real boundary, not just a display
filter: the Inbox's initial data load (`app/(inbox)/inbox/page.tsx`) is
filtered server-side to match, and `inbox-app.tsx`'s client-side filter only
covers rows arriving later via the org-wide realtime subscription. Admins
always see and can act on everything.

## Billing (Razorpay)

Plan tiers, quotas, and pricing (USD/INR × monthly/yearly) are defined once
in `packages/shared/src/plans.ts`; Razorpay Plan IDs live in env vars per
`lib/razorpay/plan-map.ts`'s naming convention (see `.env.example`, and
`scripts/create-razorpay-plans.mjs` to generate them via the API instead
of the dashboard).

Razorpay Checkout runs entirely client-side (a JS-injected popup, not an
embeddable iframe/clientSecret like Stripe), so there are two confirmation
paths that both apply the same idempotent mutation
(`lib/razorpay/billing-mutations.ts`): the client-driven `verify` route
(fast UX) and the `webhook` route (authoritative, in case the browser tab
closes before the client callback fires). Both fetch the subscription/order
back from Razorpay's API rather than trusting client-supplied plan details.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/razorpay/checkout` | session, admin | Body: `CheckoutSessionSchema` (`{kind:"plan",tier,interval,currency}` or `{kind:"addon",addon,currency,quantity}`). Creates a Razorpay Subscription (plan, or the recurring seat add-on) or Order (one-time messages add-on) and returns `{ subscriptionId \| orderId, keyId }` for `components/billing/checkout-modal.tsx` to open Checkout.js with. |
| POST | `/api/razorpay/verify` | session, admin | Body: whatever Checkout.js's success `handler` received (`razorpay_payment_id` + `razorpay_order_id`/`razorpay_subscription_id` + `razorpay_signature`). Verifies the signature via the SDK's own `validatePaymentVerification`, fetches the authoritative entity, and applies the matching mutation. |
| POST | `/api/razorpay/webhook` | Razorpay signature (`X-Razorpay-Signature`, raw body) | Idempotent on `X-Razorpay-Event-Id` (`processed_webhook_events` table). Handles `subscription.activated`/`subscription.charged` (branches on `notes.kind`: `plan` / `addon_seat`), `subscription.cancelled`/`subscription.completed` (reverts the plan subscription to `free`, or clears the seat add-on — matched by which stored subscription id it is), `subscription.halted`/`payment.failed` (sets `payment_status: 'past_due'`), `order.paid` (credits the messages add-on, guarded against the `verify` route double-crediting the same order). |
| POST | `/api/razorpay/cancel-subscription` | session, admin | Body: `{target:"plan"\|"addon_seat"}`. Calls Razorpay's cancel API (`cancel_at_cycle_end: true`); does not mutate the DB directly — the `subscription.cancelled` webhook is still the single source of truth. |
| GET | `/api/razorpay/invoices` | session, admin | Payment history for the org's plan subscription — the in-app replacement for Stripe's hosted Customer Portal, which Razorpay has no equivalent of. |

Server-side quota guards (`lib/billing/guards.ts`) gate bot creation
(`POST /api/bots`), page ingestion (`POST /api/bots/:id/sources/{website,upload}`),
AI messages (`POST /api/chat/stream`), and seat invites
(`POST /api/orgs/:id/invites`) against the org's plan + any purchased
add-ons, returning `402 Payment Required` with a human-readable `reason`
(except `chat/stream`, which degrades to a graceful SSE message — see above).

## Public API (v1)

A read-only REST surface for a customer's own systems to pull their bots and
conversations — the "Full API access" Business-plan feature. Unlike every
other route in this document, these are called with an API key, not a
session cookie.

**Auth**: `Authorization: Bearer <key>` where `<key>` looks like
`vb_live_<64 hex chars>`. Create/revoke keys from
`/dashboard/settings/api-keys` (admin-only, Business plan required to
create — see `lib/billing/guards.ts#assertHasCapability`). The secret is
shown exactly once at creation; only its 8-char prefix (`vb_live_abcd1234…`)
is ever displayed again.

**Rate limit**: 100 requests/minute per key (`lib/security/rate-limit-api.ts`),
separate from the chat-widget rate limit. A `429` means back off, not that
the key is invalid.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/bots` | List the calling org's bots (`id, name, description, created_at`). |
| GET | `/api/v1/conversations` | Paginated list, org-scoped by the key. Query params: `bot_id`, `status`, `limit` (default 25, max 100), `offset`. Response includes `pagination: {limit, offset, total}`. |
| GET | `/api/v1/conversations/:id` | One conversation plus its full ordered message history. |

Response shape for every route above is `{ "data": ... }` (or
`{ "data": [...], "pagination": {...} }` for the list route) — deliberately
different from the `{ "error": ... }` shape below so a client can branch on
presence of `data` vs. `error` without checking the status code first.
Errors still use the same status codes and `{ "error": string }` shape as
the rest of the app, including `402` when the org's plan no longer includes
API access (e.g. downgraded after the key was issued — a key stops working
immediately, it doesn't just stop being issuable).

## Platform Super Admin

Every route below requires `requirePlatformAdminApi()` — a `platform_admins`
row for the caller, independent of any org membership. All data access goes
through the service-role client, same as every other admin-only view in
this app, so none of it depends on RLS.

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/admin/orgs` | — | Every organization + member/bot counts. |
| GET | `/api/admin/orgs/:orgId` | — | One org's detail: members (with resolved emails), bots. |
| PATCH | `/api/admin/orgs/:orgId` | `UpdateOrgAdminSchema` | `plan` / `seats_limit` / `suspended` (booleans toggle `suspended_at`). |
| POST | `/api/admin/orgs/:orgId/impersonate` | — | Sets `velobot-org-id` + `velobot-impersonate-org-id` cookies; the whole `/dashboard` then works as if the Super Admin were that org's Admin (see `lib/auth/session.ts#getRoleForOrg`) — no real `org_members` row required. |
| POST | `/api/admin/exit-impersonation` | — | Clears both cookies. |
| GET | `/api/admin/platform-admins` | — | Current Super Admins with resolved emails. |
| POST | `/api/admin/platform-admins` | `PromotePlatformAdminSchema` | Promotes by email — the account must already exist (never invite-by-email, unlike org invites). |
| DELETE | `/api/admin/platform-admins/:userId` | — | Revoke. |

Bootstrapping the very first Super Admin has no UI path (nothing can
promote them yet) — `apps/web/scripts/grant-platform-admin.mjs <email>`.

## Internal

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/presence/heartbeat` | session | `{ org_id, status }`, called every 20s by `useAgentPresence`. |
| POST | `/api/internal/notify-unassigned` | `x-internal-secret` header | Called only by `supabase/functions/escalation-watcher`. Resolves emails for the ticket's queue members (`queue_id`) if set, otherwise the org's earliest-added admin. |

## Error shape

Non-2xx responses are `{ "error": string | ZodFlattenedError }`, with these
status codes used consistently: `400` invalid input, `401` no session,
`402` plan limit reached, `403` insufficient role / origin not allowed,
`404` not found, `409` optimistic-concurrency conflict (e.g. double-claim),
`429` rate limited, `500` unexpected.
