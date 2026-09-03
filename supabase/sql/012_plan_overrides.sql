-- ─────────────────────────────────────────────────────────────────────────
-- VeloBot — Super Admin plan editor: quotas, capabilities, marketing
-- features, and a per-plan promotional badge, all overridable per tier.
-- Implements the contract in packages/shared/src/types/database.ts
-- (PlanOverride, plus the new plan.update_details AdminAuditAction value).
--
-- Sibling to plan_price_overrides (010/011) — kept as a separate table
-- since price varies by (tier, interval, currency) while everything here
-- varies by tier alone. Every field is nullable: null means "use the
-- static default in packages/shared/src/plans.ts" (see
-- lib/billing/plan-overrides.ts's getEffectivePlan()).
--
-- Run this AFTER supabase/sql/011_admin_pricing_legal_coupons.sql.
-- Same caveat as every other file here: this is a testing/dev-setup aid,
-- not shipped application schema.
-- ─────────────────────────────────────────────────────────────────────────

create table plan_overrides (
  tier                        text primary key check (tier in ('free', 'hobby', 'growth', 'business')),
  quota_bots                  integer check (quota_bots >= 0),
  quota_pages                 integer check (quota_pages >= 0),
  quota_messages_per_month    integer check (quota_messages_per_month >= 0),
  quota_agent_seats           integer check (quota_agent_seats >= 0),
  capability_remove_branding  boolean,
  capability_api_access       boolean,
  -- Marketing bullets for the pricing card, e.g. ["5 bots", "Priority support"].
  features                    jsonb,
  -- Promotional ribbon text on this plan's pricing card, e.g. "20% OFF" —
  -- purely visual, not tied to a coupon or any discount calculation.
  badge_text                  text,
  updated_by                  uuid not null references auth.users(id),
  updated_at                  timestamptz not null default now()
);

-- RLS is enabled with zero policies for defense in depth — every route
-- touching this table goes through the service-role client
-- (lib/billing/plan-overrides.ts, app/api/admin/plans/[tier]/route.ts),
-- same pattern as plan_price_overrides/legal_pages/coupons.
alter table plan_overrides enable row level security;
