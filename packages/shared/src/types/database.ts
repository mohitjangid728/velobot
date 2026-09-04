/**
 * Row-level TypeScript shapes for the Postgres tables this app assumes.
 *
 * NOTE: Per the project scope, SQL table/DDL definitions are NOT part of
 * this codebase. These types describe the contract every query in
 * apps/web, apps/widget, and supabase/functions relies on — create the
 * matching tables (with RLS enabled, see docs/SECURITY.md) before running
 * the app. `embedding` columns require the pgvector extension (vector(1536)
 * for text-embedding-3-small). This includes the Connections Hub & Bot
 * Actions Engine tables (`Connection`, `BotAction`, `ConnectionLog`) below.
 */

import type { PlanTier, BillingInterval, Currency } from "../plans";

export type Role = "admin" | "agent";
export type MemberStatus = "active" | "invited";
export type PresenceStatus = "online" | "away" | "offline";
/** Alias kept for call-site stability — the allowed values are the plan tiers defined in ../plans.ts. */
export type Plan = PlanTier;
export type PaymentStatus = "active" | "past_due";

export type SourceType = "website" | "pdf" | "txt" | "docx" | "markdown";
export type SourceStatus =
  | "pending"
  | "crawling"
  | "processing"
  | "ready"
  | "failed";

export type ConversationStatus = "ai" | "queued" | "assigned" | "resolved";
export type ConversationSentiment = "positive" | "neutral" | "negative";
/** Whatever the extraction pass actually found — no fixed schema, since which entities matter (email vs. order number vs. product name) varies per bot. Values are always plain strings as they appeared in the conversation, never inferred/guessed. */
export type ExtractedEntities = Record<string, string>;
export type MessageRole = "user" | "assistant" | "agent" | "system";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  billing_interval: BillingInterval;
  currency: Currency;
  payment_status: PaymentStatus;
  /** Null for the free tier or before any subscription has ever started. */
  current_period_start: string | null;
  current_period_end: string | null;
  razorpay_customer_id: string | null;
  /** The plan subscription — distinct from `addon_seats_subscription_id` below. */
  razorpay_subscription_id: string | null;
  /** Separate subscription for the recurring seat add-on, independent of the main plan subscription. */
  addon_seats_subscription_id: string | null;
  /** Bonus AI-message pool bought on top of the plan's base monthly allowance — the one usage figure that's a real stored counter rather than derived (see lib/billing/usage.ts). */
  addon_message_balance: number;
  /** Extra seats bought on top of the plan's base `seats_limit`. */
  addon_seats: number;
  seats_limit: number;
  /** Set by a platform Super Admin to block all widget traffic and dashboard access for this org. */
  suspended_at: string | null;
  created_at: string;
  /** Stamped by app/api/internal/notify-plan-expiring so the daily reminder sends at most once per billing period — see that route's doc comment. */
  expiry_reminder_sent_at: string | null;
}

/** "full" can mutate anything (plans, suspension, deletion, promoting other admins); "support" is view-only plus notes. */
export type PlatformAdminRole = "full" | "support";

/** Presence of a row here = platform-wide Super Admin, independent of any org membership. */
export interface PlatformAdmin {
  user_id: string;
  granted_by: string | null;
  role: PlatformAdminRole;
  created_at: string;
}

export type AdminAuditAction =
  | "org.create"
  | "org.rename"
  | "org.delete"
  | "org.update_plan"
  | "org.update_seats_limit"
  | "org.update_addons"
  | "org.suspend"
  | "org.reactivate"
  | "org.impersonate"
  | "org.note_add"
  | "admin.promote"
  | "admin.demote"
  | "plan.update_price"
  | "plan.update_details"
  | "legal.update_page"
  | "coupon.create"
  | "coupon.revoke";

/** A free-text support/CRM note a Super Admin leaves on an org — e.g. "VIP customer", "disputing invoice #123". Append-only, never edited or deleted. */
export interface AdminOrgNote {
  id: string;
  org_id: string;
  author_user_id: string;
  note: string;
  created_at: string;
}

/** Append-only trail of every Super Admin action, for accountability across the platform. Written only via the service-role client — never user-editable. */
export interface AdminAuditLog {
  id: string;
  actor_user_id: string;
  action: AdminAuditAction;
  target_org_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

/** A Super-Admin-edited price that overrides the static default in ../plans.ts for one (tier, interval, currency). Absence of a row means "use the static default." */
export interface PlanPriceOverride {
  id: string;
  tier: Exclude<PlanTier, "free">;
  interval: BillingInterval;
  currency: Currency;
  amount: number;
  /** Filled in once a matching Razorpay Plan is created to charge this amount — null until then (see lib/billing/plan-pricing.ts). */
  razorpay_plan_id: string | null;
  updated_by: string;
  updated_at: string;
}

/** A Super-Admin-edited quota/capability/feature/badge override for one tier, independent of billing interval or currency — see ../plans.ts's getEffectivePlan(). Every field is nullable; null means "use the static default." */
export interface PlanOverride {
  tier: PlanTier;
  quota_bots: number | null;
  quota_pages: number | null;
  quota_messages_per_month: number | null;
  quota_agent_seats: number | null;
  capability_remove_branding: boolean | null;
  capability_api_access: boolean | null;
  features: string[] | null;
  badge_text: string | null;
  updated_by: string;
  updated_at: string;
}

export type LegalPageSlug = "terms" | "privacy" | "subprocessors";

/** Database-backed content for the public /legal/* pages, editable via admin/legal. */
export interface LegalPage {
  slug: LegalPageSlug;
  title: string;
  content_markdown: string;
  updated_by: string | null;
  updated_at: string;
}

export type CouponDiscountType = "percent" | "fixed";
export type CouponAppliesTo = "messages_addon" | "plan_subscription" | "all";

export interface Coupon {
  id: string;
  code: string;
  discount_type: CouponDiscountType;
  discount_value: number;
  applies_to: CouponAppliesTo;
  /** Required (admin-provided) only when applies_to includes plan_subscription — Razorpay Offers can't be created via API, only referenced by an id created manually in their dashboard. */
  razorpay_offer_id: string | null;
  max_redemptions: number | null;
  times_redeemed: number;
  expires_at: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

/** One redemption per (coupon, org) — enforced by a unique index, not just application code. */
export interface CouponRedemption {
  id: string;
  coupon_id: string;
  org_id: string;
  purchase_kind: Extract<CouponAppliesTo, "messages_addon" | "plan_subscription">;
  amount_discounted: number;
  redeemed_at: string;
}

export interface Queue {
  id: string;
  org_id: string;
  name: string;
  created_at: string;
}

export interface QueueMember {
  queue_id: string;
  user_id: string;
  created_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string | null;
  role: Role;
  status: MemberStatus;
  invited_email: string | null;
  invited_by: string | null;
  created_at: string;
}

export interface AgentPresence {
  user_id: string;
  org_id: string;
  status: PresenceStatus;
  last_seen_at: string;
}

export type LlmModel = "gpt-4o-mini" | "gpt-4o";
export type LlmResponseLength = "concise" | "balanced" | "detailed";

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/** Null on the bot = always open (today's behavior, unchanged). A non-null day with a null value = closed that day. Times are "HH:mm" in `timezone` (IANA name, e.g. "America/New_York"). */
export interface BusinessHours {
  timezone: string;
  days: Record<Weekday, { open: string; close: string } | null>;
}

export interface Bot {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  welcome_message: string;
  avatar_url: string | null;
  theme_color: string;
  launcher_icon_url: string | null;
  /** Origins allowed to embed this bot, e.g. ["https://acme.com"]. Empty = block all. */
  allowed_domains: string[];
  system_prompt_extra: string | null;
  fallback_email_enabled: boolean;
  /** Null = current default behavior, any org agent can claim escalated tickets. */
  queue_id: string | null;
  /** Topics the bot must decline to discuss — enforced via system-prompt instruction, not a hard filter. */
  guardrails_enabled: boolean;
  guardrails_blocked_topics: string[];
  /** Shown (or a close paraphrase) when the bot declines a blocked topic. Null = a sensible built-in default. */
  guardrails_redirect_message: string | null;
  /** Strips credit-card-like and SSN-like number patterns from the assistant's own reply before it's stored — a narrow, storage-side safety net, not a general PII scrubber (emails/phones are left alone since bots legitimately collect those for leads). */
  guardrails_pii_redaction_enabled: boolean;
  llm_model: LlmModel;
  /** 0-1 — OpenAI's own temperature range narrowed to what actually behaves sanely for support use, not the full 0-2 API range. */
  llm_temperature: number;
  llm_response_length: LlmResponseLength;
  /** When true, every user message gets a best-effort async intent/sentiment/entity extraction pass — see lib/analysis/extract-data.ts. */
  data_extraction_enabled: boolean;
  /** Business-plan only (see PLANS[tier].capabilities.removeBranding) — hides the "Powered by VeloBot" widget footer when true. Enforced server-side in the widget-config route, not just hidden in the UI. */
  branding_removed: boolean;
  /** Null = always available (today's default). Checked server-side by lib/bots/business-hours.ts, surfaced to the widget as `withinBusinessHours`. */
  business_hours: BusinessHours | null;
  consent_banner_enabled: boolean;
  /** Shown verbatim in the widget's consent strip when enabled. Null = a sensible built-in default sentence. */
  consent_banner_text: string | null;
  /** Bot-configured default for widget string localization — see apps/widget/src/i18n.ts. The widget prefers the visitor's browser language when a translation exists, falling back to this. */
  default_locale: string;
  created_at: string;
}

export type WorkflowTriggerType = "keyword";
export type WorkflowActionType = "canned_reply" | "escalate";

/**
 * A small, deterministic if/then rule that runs BEFORE the LLM sees a
 * message — not a visual flow-builder. Keyword-matched rules give a bot
 * predictable behavior for cases you don't want left to the model's
 * judgment (e.g. always escalate on "refund"), and skip the OpenAI call
 * entirely for a `canned_reply` match.
 */
export interface WorkflowRule {
  id: string;
  bot_id: string;
  name: string;
  trigger_type: WorkflowTriggerType;
  /** Comma-separated keywords/phrases; matched case-insensitively as a substring against the visitor's message. */
  trigger_value: string;
  action_type: WorkflowActionType;
  /** The canned reply text for `canned_reply`; an optional acknowledgement message for `escalate`. Null for a bare escalate with no extra text. */
  action_value: string | null;
  enabled: boolean;
  /** Lower runs first when multiple rules could match the same message. */
  position: number;
  created_at: string;
}

export interface KnowledgeSource {
  id: string;
  bot_id: string;
  type: SourceType;
  source_url: string | null;
  file_path: string | null;
  status: SourceStatus;
  pages_crawled: number;
  error_message: string | null;
  created_at: string;
}

export interface DocumentChunkMetadata {
  url?: string;
  title?: string;
  chunk_index: number;
  [key: string]: unknown;
}

export interface DocumentChunk {
  id: string;
  bot_id: string;
  source_id: string;
  content: string;
  /** vector(1536) column, pgvector extension */
  embedding: number[];
  token_count: number;
  metadata: DocumentChunkMetadata;
  created_at: string;
}

export interface Conversation {
  id: string;
  bot_id: string;
  org_id: string;
  session_id: string;
  visitor_email: string | null;
  visitor_url: string | null;
  visitor_ip: string | null;
  visitor_location: string | null;
  status: ConversationStatus;
  assigned_agent_id: string | null;
  queued_at: string | null;
  assigned_at: string | null;
  resolved_at: string | null;
  last_message_at: string;
  unread_by_agent: boolean;
  /** Set once the escalation-watcher has fired a 60s-unassigned alert, so it doesn't re-notify every poll. */
  alerted_at: string | null;
  /** Copied from bot.queue_id at the moment of escalation — not looked up live, so later reassigning a bot's queue doesn't retroactively change in-flight tickets. */
  queue_id: string | null;
  /** Best-effort, only populated when the bot has data_extraction_enabled — see lib/analysis/extract-data.ts. Never authoritative; always show as a hint, never as verified data. */
  extracted_intent: string | null;
  extracted_sentiment: ConversationSentiment | null;
  extracted_entities: ExtractedEntities | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  agent_id: string | null;
  /** Public Supabase Storage URL for a visitor- or agent-attached image/file. Null for a normal text message. */
  attachment_url: string | null;
  /** MIME type of the attachment, e.g. "image/png" — used to decide preview-vs-link rendering. Null when attachment_url is null. */
  attachment_type: string | null;
  created_at: string;
}

/** One visitor-submitted rating for a resolved conversation — at most one per conversation, submitted from the widget's post-resolve prompt. Never authoritative beyond what the visitor picked; never editable after submission. */
export interface ConversationRating {
  id: string;
  conversation_id: string;
  org_id: string;
  score: 1 | 2 | 3 | 4 | 5;
  comment: string | null;
  created_at: string;
}

/** One row per time a workflow rule matched and fired, for the "hit rate" view in the Workflow tab — modeled on ConnectionLog, not AdminAuditLog (that table's RLS and vocabulary are Super-Admin-only, wrong audience for a per-bot operational log). */
export interface WorkflowRuleHit {
  id: string;
  rule_id: string;
  bot_id: string;
  conversation_id: string;
  action_type: WorkflowActionType;
  created_at: string;
}

/** An org-scoped developer API credential (see docs/API.md "Public API (v1)"). Only `key_prefix` is ever shown again after creation — the secret itself is stored solely as `key_hash` (SHA-256) and cannot be recovered. Business-plan only (PLANS[tier].capabilities.apiAccess). */
export interface ApiKey {
  id: string;
  org_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  created_by: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface CannedReply {
  id: string;
  org_id: string;
  title: string;
  content: string;
  created_at: string;
}

export interface Invite {
  id: string;
  org_id: string;
  email: string;
  role: Role;
  token: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
}

/** Row shape returned by the match_document_chunks() RPC (see supabase/sql). */
export interface MatchedChunk {
  id: string;
  content: string;
  similarity: number;
  metadata: DocumentChunkMetadata;
}

/** Payment-gateway webhook idempotency ledger, gateway-agnostic — see lib/razorpay/webhook-idempotency.ts. */
export interface ProcessedWebhookEvent {
  event_id: string;
  created_at: string;
}

// ── Connections Hub & Bot Actions Engine ──────────────────────────────
// See lib/connections/connections-manager.ts and lib/actions/actions-manager.ts.

export type ConnectionAuthType =
  | "custom_headers"
  | "api_key"
  | "bearer_token"
  | "basic_auth"
  | "jwt"
  | "oauth2"
  | "oauth1";

/**
 * The credential mechanism for a Connection. Resolved at request time by
 * lib/connections/auth-resolver.ts. For "oauth2", `access_token`/
 * `expires_at` are system-managed — never entered by a user, only ever
 * read/written by the token-refresh logic.
 */
export type ConnectionAuthConfig =
  | { type: "custom_headers" }
  | { type: "api_key"; header_name: string; api_key: string; location: "header" | "query" }
  | { type: "bearer_token"; token: string }
  | { type: "basic_auth"; username: string; password: string }
  | { type: "jwt"; token: string }
  | {
      type: "oauth2";
      grant_type: "client_credentials" | "refresh_token";
      token_url: string;
      client_id: string;
      client_secret: string;
      scope?: string;
      /** Required for grant_type "refresh_token"; also overwritten if the provider ever rotates it on refresh. */
      refresh_token?: string;
      /** System-managed cache — set by getValidOAuth2AccessToken, not user-entered. */
      access_token?: string;
      /** System-managed, ISO timestamp. */
      expires_at?: string;
    }
  | { type: "oauth1"; consumer_key: string; consumer_secret: string; access_token: string; access_token_secret: string };

/** A reusable, workspace-scoped external API credential + base URL, shared across every bot in the org. */
export interface Connection {
  id: string;
  org_id: string;
  name: string;
  base_url: string;
  /**
   * Additional static headers layered on top of whichever auth_type below
   * resolves to (e.g. a required x-tenant-id alongside OAuth). Was the
   * *only* credential mechanism before ConnectionAuthType existed — rows
   * with no auth_type set are treated as "custom_headers" wherever this
   * is read, so nothing already configured breaks.
   */
  headers: { key: string; value: string }[];
  auth_type: ConnectionAuthType;
  auth_config: ConnectionAuthConfig;
  /** Live = offered to the AI tool-calling loop and agent quick actions; Draft = configured but dormant. */
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ActionParamType = "string" | "number" | "boolean";

/** One field the LLM should extract from the conversation before calling this action. */
export interface ActionParameter {
  name: string;
  type: ActionParamType;
  required: boolean;
  /** Extraction hint shown to the LLM as the JSON Schema property description. */
  description: string;
}

/**
 * A callable capability bound to a Connection — compiled into an OpenAI
 * tool definition at chat time. Workspace-scoped (like Connection), not
 * bot-scoped: the same action (e.g. "ticket_lookup") can be reused by
 * several bots. Which bots actually offer it is the many-to-many
 * `BotActionLink` join below, not a column here.
 */
export interface BotAction {
  id: string;
  org_id: string;
  connection_id: string;
  /** Unique per org; also the OpenAI function/tool name, so it's constrained to [a-zA-Z0-9_-]{1,64}. */
  name: string;
  method: "GET" | "POST" | "PUT";
  /** Relative to the connection's base_url; may contain {param} placeholders substituted from extracted parameters. */
  path: string;
  /** Natural-language instruction for when the LLM should invoke this action — becomes the tool's `description`. */
  trigger_description: string;
  parameters: ActionParameter[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Many-to-many: which bots currently offer a given (org-scoped) action. */
export interface BotActionLink {
  bot_id: string;
  action_id: string;
  created_at: string;
}

/** Who/what triggered a logged execution. */
export type ActionLogSource = "ai" | "agent" | "test" | "ping" | "oauth_refresh";

/** One row per HTTP call made through a Connection — AI tool calls, agent quick actions, the action tester, and connection pings all funnel through the same log. */
export interface ConnectionLog {
  id: string;
  connection_id: string;
  org_id: string;
  /** Null for a bare connection ping (no action involved). */
  action_id: string | null;
  source: ActionLogSource;
  request_method: string;
  request_path: string;
  request_body: unknown | null;
  response_status: number | null;
  response_body: unknown | null;
  latency_ms: number;
  error_message: string | null;
  created_at: string;
}
