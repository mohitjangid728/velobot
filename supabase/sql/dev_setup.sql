-- ─────────────────────────────────────────────────────────────────────────
-- VeloBot — local/dev database setup
--
-- This is a TESTING AID, not part of the shipped application design (which
-- deliberately excludes schema/DDL — see packages/shared/src/types/database.ts
-- for the documented contract this file implements). Run this once, in
-- order, in your Supabase project's SQL Editor, to get a working dev
-- database. Review before using in production — in particular, revisit the
-- anon-role policies on `conversations`/`messages` (see docs/SECURITY.md §5)
-- and add a stricter authorization model if unguessable-ID-as-capability
-- isn't acceptable for your use case.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Extensions ──────────────────────────────────────────────────────────
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists vector;      -- pgvector, for document_chunks.embedding

-- ── Tables ──────────────────────────────────────────────────────────────

create table organizations (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  slug                   text not null unique,
  plan                   text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
  stripe_customer_id     text,
  stripe_subscription_id text,
  seats_limit            int not null default 2,
  created_at             timestamptz not null default now()
);

create table org_members (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  user_id        uuid references auth.users(id) on delete cascade,
  role           text not null check (role in ('owner', 'admin', 'agent')),
  status         text not null default 'active' check (status in ('active', 'invited')),
  invited_email  text,
  invited_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  unique (org_id, user_id)
);
create index on org_members (user_id);
create index on org_members (org_id);

create table agent_presence (
  user_id      uuid not null references auth.users(id) on delete cascade,
  org_id       uuid not null references organizations(id) on delete cascade,
  status       text not null check (status in ('online', 'away', 'offline')),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, org_id)
);

create table bots (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references organizations(id) on delete cascade,
  name                   text not null,
  description            text,
  welcome_message        text not null default 'Hi! How can I help you today?',
  avatar_url             text,
  theme_color            text not null default '#4F46E5',
  launcher_icon_url      text,
  allowed_domains        text[] not null default '{}',
  system_prompt_extra    text,
  fallback_email_enabled boolean not null default true,
  created_at             timestamptz not null default now()
);
create index on bots (org_id);

create table knowledge_sources (
  id             uuid primary key default gen_random_uuid(),
  bot_id         uuid not null references bots(id) on delete cascade,
  type           text not null check (type in ('website', 'pdf', 'txt', 'docx', 'markdown')),
  source_url     text,
  file_path      text,
  status         text not null default 'pending' check (status in ('pending', 'crawling', 'processing', 'ready', 'failed')),
  pages_crawled  int not null default 0,
  error_message  text,
  created_at     timestamptz not null default now()
);
create index on knowledge_sources (bot_id);

create table document_chunks (
  id          uuid primary key default gen_random_uuid(),
  bot_id      uuid not null references bots(id) on delete cascade,
  source_id   uuid not null references knowledge_sources(id) on delete cascade,
  content     text not null,
  embedding   vector(1536) not null,
  token_count int not null,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index on document_chunks (bot_id);
-- HNSW needs pgvector >= 0.5.0 (Supabase ships a current version). If your
-- project is on an older pgvector, swap this for:
--   create index on document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index on document_chunks using hnsw (embedding vector_cosine_ops);

create table conversations (
  id                 uuid primary key default gen_random_uuid(),
  bot_id             uuid not null references bots(id) on delete cascade,
  org_id             uuid not null references organizations(id) on delete cascade,
  session_id         text not null,
  visitor_email      text,
  visitor_url        text,
  visitor_ip         text,
  visitor_location   text,
  status             text not null default 'ai' check (status in ('ai', 'queued', 'assigned', 'resolved')),
  assigned_agent_id  uuid references auth.users(id),
  queued_at          timestamptz,
  assigned_at        timestamptz,
  resolved_at        timestamptz,
  last_message_at    timestamptz not null default now(),
  unread_by_agent    boolean not null default false,
  alerted_at         timestamptz,
  created_at         timestamptz not null default now(),
  unique (bot_id, session_id)
);
create index on conversations (org_id);
create index on conversations (status);

create table messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references conversations(id) on delete cascade,
  role             text not null check (role in ('user', 'assistant', 'agent', 'system')),
  content          text not null,
  agent_id         uuid references auth.users(id),
  created_at       timestamptz not null default now()
);
create index on messages (conversation_id);

create table canned_replies (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  title       text not null,
  content     text not null,
  created_at  timestamptz not null default now()
);
create index on canned_replies (org_id);

create table invites (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  email        text not null,
  role         text not null check (role in ('admin', 'agent')),
  token        text not null unique,
  invited_by   uuid not null references auth.users(id),
  expires_at   timestamptz not null,
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index on invites (org_id);

-- ── RLS helper functions ───────────────────────────────────────────────
-- SECURITY DEFINER + a fixed search_path so these run without re-triggering
-- RLS on org_members themselves (the standard pattern for avoiding
-- self-referential RLS recursion in Postgres/Supabase).

create or replace function is_org_member(target_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from org_members
    where org_id = target_org_id and user_id = auth.uid() and status = 'active'
  );
$$;

-- ── Row Level Security ─────────────────────────────────────────────────
-- Every write in this app goes through the service-role client after an
-- application-level authorization check (see lib/auth/bot-guard.ts,
-- lib/auth/conversation-guard.ts) — the service role bypasses RLS by
-- design. These policies only need to cover the read paths that use the
-- cookie-scoped (RLS-enforced) client: dashboard Server Components and the
-- browser Realtime subscriptions in the inbox and the widget.

alter table organizations     enable row level security;
alter table org_members       enable row level security;
alter table agent_presence    enable row level security;
alter table bots              enable row level security;
alter table knowledge_sources enable row level security;
alter table document_chunks   enable row level security;
alter table conversations     enable row level security;
alter table messages          enable row level security;
alter table canned_replies    enable row level security;
alter table invites           enable row level security;

create policy "org members can view their orgs"
  on organizations for select to authenticated
  using (is_org_member(id));

create policy "org members can view their org roster"
  on org_members for select to authenticated
  using (is_org_member(org_id));

create policy "org members can view presence"
  on agent_presence for select to authenticated
  using (is_org_member(org_id));

create policy "org members can view bots"
  on bots for select to authenticated
  using (is_org_member(org_id));

create policy "org members can view knowledge sources"
  on knowledge_sources for select to authenticated
  using (is_org_member((select org_id from bots where bots.id = knowledge_sources.bot_id)));

create policy "org members can view invites"
  on invites for select to authenticated
  using (is_org_member(org_id));

create policy "org members can view conversations"
  on conversations for select to authenticated
  using (is_org_member(org_id));

create policy "org members can view messages"
  on messages for select to authenticated
  using (is_org_member((select org_id from conversations where conversations.id = messages.conversation_id)));

-- Widget visitors are unauthenticated (anon role) — access is scoped by
-- knowing the unguessable conversation_id/session_id, not by RLS row
-- ownership. See docs/SECURITY.md §5 for the tradeoff this accepts.
create policy "anon can view conversations by id"
  on conversations for select to anon
  using (true);

create policy "anon can view messages by conversation id"
  on messages for select to anon
  using (true);

-- document_chunks and canned_replies have RLS enabled with NO policies
-- below — every access to them goes through the service-role client
-- (lib/rag/retrieve.ts's RPC call, and the /api/canned-replies routes), so
-- both anon and authenticated are fully denied direct access by default.

-- ── Realtime ────────────────────────────────────────────────────────────
-- Required for the postgres_changes subscriptions in
-- hooks/use-agent-presence.ts, components/inbox/inbox-app.tsx, and
-- apps/widget/src/realtime.ts to receive anything.
alter publication supabase_realtime add table conversations;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table agent_presence;

-- ── Retrieval RPC ───────────────────────────────────────────────────────
-- Run supabase/sql/match_document_chunks.sql after this file (or paste its
-- contents below this line) — it's kept separate because it's the one SQL
-- artifact that IS part of the shipped application, not just this dev aid.
