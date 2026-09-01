-- ─────────────────────────────────────────────────────────────────────────
-- VeloBot — incremental dev/test setup for Super Admin + Queues
--
-- Run this AFTER supabase/sql/dev_setup.sql (which you've already applied).
-- Same caveat as that file: this is a testing/dev-setup aid, not shipped
-- application schema — see packages/shared/src/types/database.ts for the
-- contract this implements.
-- ─────────────────────────────────────────────────────────────────────────

-- ── New columns on existing tables ──────────────────────────────────────
alter table organizations add column suspended_at timestamptz;

-- ── New tables ──────────────────────────────────────────────────────────

create table platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  granted_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create table queues (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);
create index on queues (org_id);

create table queue_members (
  queue_id    uuid not null references queues(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (queue_id, user_id)
);
create index on queue_members (user_id);

alter table bots add column queue_id uuid references queues(id) on delete set null;
alter table conversations add column queue_id uuid references queues(id) on delete set null;
create index on conversations (queue_id);

-- ── RLS helper: is_platform_admin ──────────────────────────────────────
create or replace function is_platform_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from platform_admins where user_id = uid);
$$;

-- ── is_org_member() redefined to also grant Super Admins blanket read ──
-- access across every org-scoped table (bots, conversations, messages,
-- etc. all key their RLS policies off this one function). This is what
-- makes impersonation work without touching each table's policy
-- individually — see docs/SECURITY.md for the full explanation. Write
-- access still requires the impersonation cookie + app-level role checks
-- (lib/auth/session.ts), this only grants reads.
create or replace function is_org_member(target_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    exists (
      select 1 from org_members
      where org_id = target_org_id and user_id = auth.uid() and status = 'active'
    )
    or is_platform_admin(auth.uid());
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────
alter table queues enable row level security;
alter table queue_members enable row level security;
alter table platform_admins enable row level security;

create policy "org members can view queues"
  on queues for select to authenticated
  using (is_org_member(org_id));

create policy "org members can view queue members"
  on queue_members for select to authenticated
  using (is_org_member((select org_id from queues where queues.id = queue_members.queue_id)));

-- Sufficient for the isPlatformAdmin() app-level check (a user checking
-- their own row). The /admin panel's "list all admins" view goes through
-- the service-role client, like every other admin-only list in this app,
-- so it doesn't need a broader policy here.
create policy "users can view their own platform_admins row"
  on platform_admins for select to authenticated
  using (user_id = auth.uid());

-- ── Realtime ────────────────────────────────────────────────────────────
-- Not required for this feature — queues/platform_admins have no live
-- client-side subscriptions — included only for parity/completeness if
-- you later want live queue membership updates in the dashboard.
-- alter publication supabase_realtime add table queue_members;
