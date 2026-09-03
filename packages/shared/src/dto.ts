import { z } from "zod";

// ── Billing / checkout ───────────────────────────────────────────────────
// Tier/interval/currency literals are duplicated from plans.ts rather than
// derived from its arrays, because those arrays are typed as plain `T[]`
// (not literal tuples), which would widen z.enum()'s inferred type back to
// `string` — TypeScript will still catch any drift since PlanTier/
// BillingInterval/Currency themselves are used throughout this file's
// call sites.
export const CheckoutPlanSchema = z.object({
  kind: z.literal("plan"),
  tier: z.enum(["hobby", "growth", "business"]),
  interval: z.enum(["monthly", "yearly"]),
  currency: z.enum(["USD", "INR"]),
  couponCode: z.string().min(1).max(40).optional(),
});

export const CheckoutAddonSchema = z.object({
  kind: z.literal("addon"),
  addon: z.enum(["messages", "seat"]),
  currency: z.enum(["USD", "INR"]),
  quantity: z.number().int().min(1).max(20).default(1),
  couponCode: z.string().min(1).max(40).optional(),
});

export const CheckoutSessionSchema = z.discriminatedUnion("kind", [CheckoutPlanSchema, CheckoutAddonSchema]);
export type CheckoutSessionInput = z.infer<typeof CheckoutSessionSchema>;

// ── Connections Hub ────────────────────────────────────────────────────
export const ConnectionHeaderSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().min(1).max(2000),
});

// One member per ConnectionAuthType. `access_token`/`expires_at` on the
// oauth2 shape are deliberately absent here — they're system-managed
// (lib/connections/auth-resolver.ts), never accepted from a client request.
export const ConnectionAuthConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("custom_headers") }),
  z.object({
    type: z.literal("api_key"),
    header_name: z.string().min(1).max(100),
    api_key: z.string().min(1).max(2000),
    location: z.enum(["header", "query"]),
  }),
  z.object({ type: z.literal("bearer_token"), token: z.string().min(1).max(4000) }),
  z.object({ type: z.literal("basic_auth"), username: z.string().min(1).max(200), password: z.string().min(1).max(2000) }),
  z.object({ type: z.literal("jwt"), token: z.string().min(1).max(8000) }),
  z.object({
    type: z.literal("oauth2"),
    grant_type: z.enum(["client_credentials", "refresh_token"]),
    token_url: z.string().url(),
    client_id: z.string().min(1).max(500),
    client_secret: z.string().min(1).max(2000),
    scope: z.string().max(500).optional(),
    refresh_token: z.string().max(4000).optional(),
  }),
  z.object({
    type: z.literal("oauth1"),
    consumer_key: z.string().min(1).max(500),
    consumer_secret: z.string().min(1).max(2000),
    access_token: z.string().min(1).max(2000),
    access_token_secret: z.string().min(1).max(2000),
  }),
]);

export const CreateConnectionSchema = z
  .object({
    name: z.string().min(2).max(80),
    base_url: z.string().url().startsWith("https://", "Base URL must be HTTPS"),
    /** Additional static headers layered on top of auth_config — no longer the only credential mechanism. */
    headers: z.array(ConnectionHeaderSchema).max(20).default([]),
    auth_type: z
      .enum(["custom_headers", "api_key", "bearer_token", "basic_auth", "jwt", "oauth2", "oauth1"])
      .default("custom_headers"),
    auth_config: ConnectionAuthConfigSchema.default({ type: "custom_headers" }),
    is_active: z.boolean().default(true),
  })
  .refine((v) => v.auth_type === v.auth_config.type, {
    message: "auth_type must match auth_config.type",
    path: ["auth_config"],
  });
export type CreateConnectionInput = z.infer<typeof CreateConnectionSchema>;

// `.partial()` isn't available after `.refine()`, so the update schema is
// built from the pre-refine shape directly and re-validated the same way.
export const UpdateConnectionSchema = z
  .object({
    name: z.string().min(2).max(80),
    base_url: z.string().url().startsWith("https://", "Base URL must be HTTPS"),
    headers: z.array(ConnectionHeaderSchema).max(20),
    auth_type: z.enum(["custom_headers", "api_key", "bearer_token", "basic_auth", "jwt", "oauth2", "oauth1"]),
    auth_config: ConnectionAuthConfigSchema,
    is_active: z.boolean(),
  })
  .partial()
  .refine((v) => v.auth_type === undefined || v.auth_config === undefined || v.auth_type === v.auth_config.type, {
    message: "auth_type must match auth_config.type",
    path: ["auth_config"],
  });
export type UpdateConnectionInput = z.infer<typeof UpdateConnectionSchema>;

// ── Bot Actions Engine ─────────────────────────────────────────────────
export const ActionParameterSchema = z.object({
  name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Must be a valid identifier").max(64),
  type: z.enum(["string", "number", "boolean"]),
  required: z.boolean().default(false),
  description: z.string().min(1).max(300),
});

export const CreateActionSchema = z.object({
  connection_id: z.string().uuid(),
  name: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/, "Use letters, numbers, underscores, or hyphens"),
  method: z.enum(["GET", "POST", "PUT"]),
  path: z.string().min(1).max(300),
  trigger_description: z.string().min(1).max(500),
  parameters: z.array(ActionParameterSchema).max(20).default([]),
  is_active: z.boolean().default(true),
  /** Which of the org's bots offer this action — full-replace semantics on update, same as `allowed_domains`. */
  bot_ids: z.array(z.string().uuid()).max(200).default([]),
});
export type CreateActionInput = z.infer<typeof CreateActionSchema>;

export const UpdateActionSchema = CreateActionSchema.partial();
export type UpdateActionInput = z.infer<typeof UpdateActionSchema>;

const ActionParamValueSchema = z.union([z.string(), z.number(), z.boolean()]);
export const RunActionSchema = z.object({
  params: z.record(ActionParamValueSchema).default({}),
});
export type RunActionInput = z.infer<typeof RunActionSchema>;

// ── Organizations ──────────────────────────────────────────────────────
export const CreateOrgSchema = z.object({
  name: z.string().min(2).max(80),
});
export type CreateOrgInput = z.infer<typeof CreateOrgSchema>;

// ── Invites ────────────────────────────────────────────────────────────
export const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "agent"]), // owners aren't invited, they're created with the org
});
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;

// ── Bots ───────────────────────────────────────────────────────────────
const WeekdayHoursSchema = z.object({ open: z.string().regex(/^\d{2}:\d{2}$/), close: z.string().regex(/^\d{2}:\d{2}$/) }).nullable();
export const BusinessHoursSchema = z.object({
  timezone: z.string().min(1).max(64),
  days: z.object({
    mon: WeekdayHoursSchema,
    tue: WeekdayHoursSchema,
    wed: WeekdayHoursSchema,
    thu: WeekdayHoursSchema,
    fri: WeekdayHoursSchema,
    sat: WeekdayHoursSchema,
    sun: WeekdayHoursSchema,
  }),
});

// Every field a bot can have is accepted at creation time, not just
// name/welcome/color — the rest (branding, embed domains, custom
// instructions, fallback email, queue) used to be Update-only, forcing a
// second trip to Settings right after creating a bot. UpdateBotSchema is
// just the partial of this, so the two can never drift apart.
export const CreateBotSchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(280).optional(),
  welcome_message: z.string().min(1).max(300).default("Hi! How can I help you today?"),
  theme_color: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
    .default("#4F46E5"),
  avatar_url: z.string().url().nullable().optional(),
  launcher_icon_url: z.string().url().nullable().optional(),
  allowed_domains: z.array(z.string().min(3)).max(50).optional(),
  system_prompt_extra: z.string().max(2000).nullable().optional(),
  fallback_email_enabled: z.boolean().optional(),
  queue_id: z.string().uuid().nullable().optional(),
  guardrails_enabled: z.boolean().optional(),
  guardrails_blocked_topics: z.array(z.string().min(1).max(60)).max(30).optional(),
  guardrails_redirect_message: z.string().max(300).nullable().optional(),
  guardrails_pii_redaction_enabled: z.boolean().optional(),
  llm_model: z.enum(["gpt-4o-mini", "gpt-4o"]).optional(),
  llm_temperature: z.number().min(0).max(1).optional(),
  llm_response_length: z.enum(["concise", "balanced", "detailed"]).optional(),
  data_extraction_enabled: z.boolean().optional(),
  /** Only takes effect when the org's plan has capabilities.removeBranding — see lib/billing/guards.ts. */
  branding_removed: z.boolean().optional(),
  business_hours: BusinessHoursSchema.nullable().optional(),
  consent_banner_enabled: z.boolean().optional(),
  consent_banner_text: z.string().max(500).nullable().optional(),
  default_locale: z.string().min(2).max(10).optional(),
});
export type CreateBotInput = z.infer<typeof CreateBotSchema>;

export const UpdateBotSchema = CreateBotSchema.partial();
export type UpdateBotInput = z.infer<typeof UpdateBotSchema>;

// ── Workflow rules (bot-scoped) ──────────────────────────────────────────
export const CreateWorkflowRuleSchema = z.object({
  name: z.string().min(1).max(80),
  trigger_type: z.literal("keyword").default("keyword"),
  trigger_value: z.string().min(1).max(300),
  action_type: z.enum(["canned_reply", "escalate"]),
  action_value: z.string().max(1000).nullable().optional(),
  enabled: z.boolean().default(true),
  position: z.number().int().min(0).default(0),
});
export type CreateWorkflowRuleInput = z.infer<typeof CreateWorkflowRuleSchema>;

export const UpdateWorkflowRuleSchema = CreateWorkflowRuleSchema.partial();
export type UpdateWorkflowRuleInput = z.infer<typeof UpdateWorkflowRuleSchema>;

// ── Queues ─────────────────────────────────────────────────────────────
export const CreateQueueSchema = z.object({
  name: z.string().min(1).max(60),
});
export type CreateQueueInput = z.infer<typeof CreateQueueSchema>;

export const UpdateQueueSchema = z.object({
  name: z.string().min(1).max(60),
});

// ── Knowledge ingestion ───────────────────────────────────────────────
export const IngestWebsiteSchema = z.object({
  url: z.string().url(),
  max_pages: z.number().int().min(1).max(500).default(150),
});
export type IngestWebsiteInput = z.infer<typeof IngestWebsiteSchema>;

// ── Chat (widget-facing) ──────────────────────────────────────────────
export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const ChatStreamRequestSchema = z.object({
  bot_id: z.string().uuid(),
  session_id: z.string().min(8).max(128),
  message: z.string().min(1).max(4000),
  history: z.array(ChatMessageSchema).max(20).default([]),
  page_url: z.string().url().optional(),
  /** Set only when this message carries a file/screenshot the visitor already uploaded via /api/chat/upload — the message itself is still required (a caption, even if just "see attached"). */
  attachment_url: z.string().url().nullable().optional(),
  attachment_type: z.string().max(100).nullable().optional(),
});
export type ChatStreamRequest = z.infer<typeof ChatStreamRequestSchema>;

// ── Dashboard "Test bot" panel (session-authenticated, not widget-facing) ──
export const TestChatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z.array(ChatMessageSchema).max(20).default([]),
});
export type TestChatRequest = z.infer<typeof TestChatRequestSchema>;

export const EscalateSchema = z.object({
  bot_id: z.string().uuid(),
  session_id: z.string().min(8).max(128),
  visitor_email: z.string().email().nullable().optional(),
  page_url: z.string().url().optional(),
});
export type EscalateInput = z.infer<typeof EscalateSchema>;

export const OfflineEmailCaptureSchema = z.object({
  bot_id: z.string().uuid(),
  session_id: z.string().min(8).max(128),
  visitor_email: z.string().email(),
  message: z.string().min(1).max(2000),
});

// ── Agent inbox ────────────────────────────────────────────────────────
export const SendAgentMessageSchema = z.object({
  conversation_id: z.string().uuid(),
  content: z.string().min(1).max(4000),
});

export const CannedReplySchema = z.object({
  title: z.string().min(1).max(80),
  content: z.string().min(1).max(2000),
});

// ── Platform Super Admin ──────────────────────────────────────────────
const OrgSlugSchema = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only");

export const CreateOrgAdminSchema = z.object({
  name: z.string().min(1).max(100),
  slug: OrgSlugSchema.optional(),
});
export type CreateOrgAdminInput = z.infer<typeof CreateOrgAdminSchema>;

export const UpdateOrgAdminSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: OrgSlugSchema.optional(),
  plan: z.enum(["free", "hobby", "growth", "business"]).optional(),
  seats_limit: z.number().int().min(1).max(1000).optional(),
  suspended: z.boolean().optional(),
  addon_message_balance: z.number().int().min(0).max(10_000_000).optional(),
  addon_seats: z.number().int().min(0).max(1000).optional(),
});
export type UpdateOrgAdminInput = z.infer<typeof UpdateOrgAdminSchema>;

export const PromotePlatformAdminSchema = z.object({
  email: z.string().email(),
  role: z.enum(["full", "support"]).default("full"),
});

export const CreateOrgNoteSchema = z.object({
  note: z.string().min(1).max(2000),
});
export type CreateOrgNoteInput = z.infer<typeof CreateOrgNoteSchema>;

// ── Plan pricing overrides (admin/pricing) ────────────────────────────────
export const UpdatePlanPriceSchema = z.object({
  tier: z.enum(["hobby", "growth", "business"]),
  interval: z.enum(["monthly", "yearly"]),
  currency: z.enum(["USD", "INR"]),
  amount: z.number().int().min(0).max(1_000_000),
});
export type UpdatePlanPriceInput = z.infer<typeof UpdatePlanPriceSchema>;

// ── Legal pages (admin/legal) ──────────────────────────────────────────────
export const UpdateLegalPageSchema = z.object({
  title: z.string().min(1).max(200),
  content_markdown: z.string().min(1).max(50_000),
});
export type UpdateLegalPageInput = z.infer<typeof UpdateLegalPageSchema>;

// ── Coupons (admin/coupons) ────────────────────────────────────────────────
// razorpay_offer_id's requirement for plan_subscription/all is enforced by
// the .refine below rather than a discriminated union, since discount_type
// and applies_to vary independently.
export const CreateCouponSchema = z
  .object({
    code: z
      .string()
      .min(3)
      .max(40)
      .regex(/^[A-Z0-9_-]+$/, "Uppercase letters, numbers, hyphens, and underscores only"),
    discount_type: z.enum(["percent", "fixed"]),
    discount_value: z.number().positive(),
    applies_to: z.enum(["messages_addon", "plan_subscription", "all"]),
    // Required only when applies_to includes plan_subscription — Razorpay
    // Offers can't be created via API (dashboard only), so the Super Admin
    // creates the matching Offer there first and pastes its id here.
    razorpay_offer_id: z.string().min(1).max(100).optional(),
    max_redemptions: z.number().int().positive().optional(),
    expires_at: z.string().datetime().optional(),
  })
  .refine((data) => data.discount_type !== "percent" || data.discount_value <= 100, {
    message: "A percentage discount can't exceed 100",
    path: ["discount_value"],
  })
  .refine((data) => data.applies_to === "messages_addon" || !!data.razorpay_offer_id, {
    message: "A Razorpay offer ID is required for coupons that apply to plan subscriptions",
    path: ["razorpay_offer_id"],
  });
export type CreateCouponInput = z.infer<typeof CreateCouponSchema>;

// ── Conversation ratings (widget-facing) ──────────────────────────────
export const SubmitRatingSchema = z.object({
  bot_id: z.string().uuid(),
  session_id: z.string().min(8).max(128),
  score: z.number().int().min(1).max(5),
  comment: z.string().max(1000).nullable().optional(),
});
export type SubmitRatingInput = z.infer<typeof SubmitRatingSchema>;

// ── Developer API keys (org-scoped) ───────────────────────────────────
export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(80),
});
export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;

export const UpdateApiKeySchema = z.object({
  revoked: z.literal(true),
});
export type UpdateApiKeyInput = z.infer<typeof UpdateApiKeySchema>;
