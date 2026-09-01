-- ─────────────────────────────────────────────────────────────────────────
-- VeloBot — incremental dev/test setup for the Super Admin audit trail
--
-- Run this AFTER supabase/sql/002_platform_admin_and_queues.sql (which
-- creates platform_admins and is_platform_admin()). Same caveat as that
-- file: this is a testing/dev-setup aid, not shipped application schema —
-- see packages/shared/src/types/database.ts for the contract this
-- implements (AdminAuditLog).
-- ─────────────────────────────────────────────────────────────────────────

-- ── New table ───────────────────────────────────────────────────────────

create table admin_audit_log (
  id             uuid primary key default gen_random_uuid(),
  actor_user_id  uuid not null references auth.users(id),
  action         text not null,
  target_org_id  uuid references organizations(id) on delete set null,
  details        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index on admin_audit_log (target_org_id);
create index on admin_audit_log (created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────
-- Every row is written by app code through the service-role client (see
-- apps/web/lib/admin/audit-log.ts), which bypasses RLS entirely — this
-- policy only matters if a client ever queries the table directly, and
-- restricts that to Super Admins, consistent with every other admin-only
-- table in this app.
alter table admin_audit_log enable row level security;

create policy "platform admins can view audit log"
  on admin_audit_log for select to authenticated
  using (is_platform_admin(auth.uid()));
