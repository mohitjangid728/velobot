-- ─────────────────────────────────────────────────────────────────────────
-- VeloBot — four bot-level chatbot features: Guardrails, LLM settings,
-- Data Extraction, and a lightweight keyword-triggered Workflow engine.
-- Implements the contract in packages/shared/src/types/database.ts
-- (Bot's new guardrails_*/llm_*/data_extraction_enabled columns,
-- Conversation's new extracted_* columns, and the new WorkflowRule type).
--
-- Run this AFTER supabase/sql/dev_setup.sql (which created `bots` and
-- `conversations`). Same caveat as every other file here: this is a
-- testing/dev-setup aid, not shipped application schema.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Bot: Guardrails ─────────────────────────────────────────────────────
alter table bots add column guardrails_enabled boolean not null default false;
alter table bots add column guardrails_blocked_topics jsonb not null default '[]'::jsonb;
alter table bots add column guardrails_redirect_message text;
alter table bots add column guardrails_pii_redaction_enabled boolean not null default false;

-- ── Bot: LLM settings ───────────────────────────────────────────────────
alter table bots add column llm_model text not null default 'gpt-4o-mini' check (llm_model in ('gpt-4o-mini', 'gpt-4o'));
alter table bots add column llm_temperature numeric(3, 2) not null default 0.3 check (llm_temperature >= 0 and llm_temperature <= 1);
alter table bots add column llm_response_length text not null default 'balanced' check (llm_response_length in ('concise', 'balanced', 'detailed'));

-- ── Bot: Data extraction toggle ─────────────────────────────────────────
alter table bots add column data_extraction_enabled boolean not null default false;

-- ── Conversations: extraction results ───────────────────────────────────
alter table conversations add column extracted_intent text;
alter table conversations add column extracted_sentiment text check (extracted_sentiment in ('positive', 'neutral', 'negative'));
alter table conversations add column extracted_entities jsonb;

-- ── New table: bot_workflow_rules ───────────────────────────────────────
create table bot_workflow_rules (
  id             uuid primary key default gen_random_uuid(),
  bot_id         uuid not null references bots(id) on delete cascade,
  name           text not null,
  trigger_type   text not null default 'keyword' check (trigger_type in ('keyword')),
  trigger_value  text not null,
  action_type    text not null check (action_type in ('canned_reply', 'escalate')),
  action_value   text,
  enabled        boolean not null default true,
  "position"     integer not null default 0,
  created_at     timestamptz not null default now()
);
create index on bot_workflow_rules (bot_id);

-- ── RLS ─────────────────────────────────────────────────────────────────
-- Every route that reads or writes bot_workflow_rules goes through the
-- service-role client (lib/workflow/workflow-manager.ts), same as
-- Connections/Actions in 004_connections_actions_auth.sql — RLS is enabled
-- with zero policies for defense in depth, not for RLS-scoped client
-- access (there isn't any for this feature).
alter table bot_workflow_rules enable row level security;
