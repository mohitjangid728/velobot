-- ─────────────────────────────────────────────────────────────────────────
-- VeloBot — incremental dev/test setup for scoped Super Admin roles and
-- per-org support notes.
--
-- Run this AFTER supabase/sql/002_platform_admin_and_queues.sql (which
-- creates platform_admins and is_platform_admin()). Same caveat as every
-- other file here: this is a testing/dev-setup aid, not shipped
-- application schema — see packages/shared/src/types/database.ts for the
-- contract this implements (PlatformAdmin.role, AdminOrgNote).
-- ─────────────────────────────────────────────────────────────────────────

-- ── Scoped admin roles ──────────────────────────────────────────────────
-- "full" can mutate anything (plans, suspension, deletion, promoting other
-- admins); "support" is view-only across the admin panel, plus notes.
alter table platform_admins add column role text not null default 'full' check (role in ('full', 'support'));

-- ── Per-org support notes ───────────────────────────────────────────────
create table admin_org_notes (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  author_user_id  uuid not null references auth.users(id),
  note            text not null,
  created_at      timestamptz not null default now()
);
create index on admin_org_notes (org_id);

alter table admin_org_notes enable row level security;

create policy "platform admins can view org notes"
  on admin_org_notes for select to authenticated
  using (is_platform_admin(auth.uid()));
