-- ─────────────────────────────────────────────────────────────────────────
-- VeloBot — incremental dev/test setup for the Connections Hub & Bot
-- Actions Engine (including the multi-standard auth layer: API Key,
-- Bearer, Basic, JWT, OAuth 2.0 with auto-refresh, OAuth 1.0a).
--
-- Run this AFTER supabase/sql/dev_setup.sql,
-- supabase/sql/002_platform_admin_and_queues.sql, and
-- supabase/sql/003_billing.sql. Same caveat as those files: a
-- testing/dev-setup aid, not shipped application schema — see
-- packages/shared/src/types/database.ts for the contract this implements
-- (Connection, ConnectionAuthConfig, BotAction, BotActionLink,
-- ConnectionLog).
-- ─────────────────────────────────────────────────────────────────────────

-- ── Connections (workspace-scoped, shared across every bot in the org) ──
create table connections (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  base_url    text not null,
  -- Additional static headers layered on top of auth_config, e.g. a
  -- required x-tenant-id alongside OAuth. [{key, value}, ...]
  headers     jsonb not null default '[]'::jsonb,
  auth_type   text not null default 'custom_headers'
    check (auth_type in ('custom_headers', 'api_key', 'bearer_token', 'basic_auth', 'jwt', 'oauth2', 'oauth1')),
  -- Shape depends on auth_type — see ConnectionAuthConfig in
  -- packages/shared/src/types/database.ts. For auth_type = 'oauth2', this
  -- also holds the system-managed access_token/expires_at cache, written
  -- back by lib/connections/auth-resolver.ts on every refresh.
  auth_config jsonb not null default '{"type": "custom_headers"}'::jsonb,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on connections (org_id);

-- ── Bot Actions (workspace-scoped, linkable to multiple bots) ───────────
create table bot_actions (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references organizations(id) on delete cascade,
  connection_id        uuid not null references connections(id) on delete cascade,
  -- Unique per org; also the OpenAI function/tool name.
  name                 text not null,
  method               text not null check (method in ('GET', 'POST', 'PUT')),
  path                 text not null,
  trigger_description  text not null,
  -- [{name, type, required, description}, ...]
  parameters           jsonb not null default '[]'::jsonb,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (org_id, name)
);
create index on bot_actions (org_id);
create index on bot_actions (connection_id);

-- ── Bot <-> Action links (many-to-many: one action, several bots) ──────
create table bot_action_links (
  bot_id      uuid not null references bots(id) on delete cascade,
  action_id   uuid not null references bot_actions(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (bot_id, action_id)
);
create index on bot_action_links (action_id);

-- ── Delivery / audit logs ───────────────────────────────────────────────
create table connection_logs (
  id               uuid primary key default gen_random_uuid(),
  connection_id    uuid not null references connections(id) on delete cascade,
  org_id           uuid not null references organizations(id) on delete cascade,
  -- Null for a bare connection ping or an OAuth token refresh — neither
  -- is tied to a specific action.
  action_id        uuid references bot_actions(id) on delete set null,
  source           text not null check (source in ('ai', 'agent', 'test', 'ping', 'oauth_refresh')),
  request_method   text not null,
  request_path     text not null,
  request_body     jsonb,
  response_status  integer,
  response_body    jsonb,
  latency_ms       integer not null,
  error_message    text,
  created_at       timestamptz not null default now()
);
create index on connection_logs (connection_id, created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────
-- Every route that reads or writes these four tables goes through the
-- service-role client (lib/connections/connections-manager.ts,
-- lib/actions/actions-manager.ts, lib/connections/auth-resolver.ts) —
-- there is no RLS-scoped client access anywhere in this feature. RLS is
-- enabled with zero policies for defense in depth, same as
-- processed_webhook_events in 003_billing.sql: the default is a full deny
-- to anon/authenticated, which is exactly right here since credentials
-- (auth_config secrets, connection_logs bodies) must never be reachable
-- except through the app's own masking/authorization logic.
alter table connections enable row level security;
alter table bot_actions enable row level security;
alter table bot_action_links enable row level security;
alter table connection_logs enable row level security;
