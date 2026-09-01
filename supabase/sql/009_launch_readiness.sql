-- ─────────────────────────────────────────────────────────────────────────
-- VeloBot — launch-readiness batch: branding removal, business hours,
-- consent banner, widget locale, conversation ratings (CSAT), workflow-rule
-- hit logging, and org-scoped developer API keys.
-- Implements the contract in packages/shared/src/types/database.ts (Bot's
-- new branding_removed/business_hours/consent_banner_*/default_locale
-- columns, Message's new attachment_* columns, and the new
-- ConversationRating, WorkflowRuleHit, ApiKey types).
--
-- Run this AFTER supabase/sql/008_guardrails_llm_workflow_extraction.sql.
-- Same caveat as every other file here: this is a testing/dev-setup aid,
-- not shipped application schema.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Bot: branding removal (Business plan only, see plans.ts capabilities) ──
alter table bots add column branding_removed boolean not null default false;

-- ── Bot: business hours ─────────────────────────────────────────────────
-- Null = always available (today's default). Shape matches BusinessHours in
-- database.ts: {timezone, days: {mon..sun: {open,close}|null}}.
alter table bots add column business_hours jsonb;

-- ── Bot: cookie/consent banner ──────────────────────────────────────────
alter table bots add column consent_banner_enabled boolean not null default false;
alter table bots add column consent_banner_text text;

-- ── Bot: widget locale default ──────────────────────────────────────────
alter table bots add column default_locale text not null default 'en';

-- ── Messages: attachments ───────────────────────────────────────────────
alter table messages add column attachment_url text;
alter table messages add column attachment_type text;

-- ── New table: conversation_ratings (CSAT) ──────────────────────────────
create table conversation_ratings (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  org_id          uuid not null references organizations(id) on delete cascade,
  score           smallint not null check (score between 1 and 5),
  comment         text,
  created_at      timestamptz not null default now()
);
create index on conversation_ratings (conversation_id);

-- ── New table: bot_workflow_rule_hits ───────────────────────────────────
-- Modeled on connection_logs (004_connections_actions_auth.sql), not
-- admin_audit_log — this is a per-bot operational log, not a Super-Admin
-- accountability trail, and admin_audit_log's RLS/vocabulary are scoped to
-- platform admins only.
create table bot_workflow_rule_hits (
  id              uuid primary key default gen_random_uuid(),
  rule_id         uuid not null references bot_workflow_rules(id) on delete cascade,
  bot_id          uuid not null references bots(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  action_type     text not null check (action_type in ('canned_reply', 'escalate')),
  created_at      timestamptz not null default now()
);
create index on bot_workflow_rule_hits (rule_id, created_at desc);

-- ── New table: api_keys (org-scoped developer API, Business plan only) ──
create table api_keys (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  name          text not null,
  key_prefix    text not null,
  key_hash      text not null,
  created_by    uuid not null,
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index on api_keys (org_id);
create unique index on api_keys (key_hash);

-- ── RLS ─────────────────────────────────────────────────────────────────
-- Every route touching these four tables goes through the service-role
-- client (lib/analysis/*, lib/workflow/workflow-manager.ts, lib/auth/api-key.ts)
-- — RLS is enabled with zero policies for defense in depth, not for
-- RLS-scoped client access (there isn't any for this feature).
alter table conversation_ratings enable row level security;
alter table bot_workflow_rule_hits enable row level security;
alter table api_keys enable row level security;

-- ── Manual step (not SQL): Supabase Storage ─────────────────────────────
-- Create a Storage bucket named `conversation-attachments` (public read,
-- write via signed upload URL only) in the Supabase dashboard for the
-- widget file/screenshot attachment feature — Storage buckets aren't
-- created via SQL migrations in this project.
