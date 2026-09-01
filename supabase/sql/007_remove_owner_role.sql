-- ─────────────────────────────────────────────────────────────────────────
-- VeloBot — collapses the "owner" role into "admin". Admin now has every
-- permission owner used to (billing, connections, actions, workspace
-- settings, deleting the workspace) — see
-- packages/shared/src/types/database.ts's Role type and
-- packages/shared/src/constants.ts's ROLE_RANK, both narrowed to
-- "admin" | "agent".
--
-- Run this AFTER supabase/sql/dev_setup.sql (which created the original
-- `role text not null check (role in ('owner', 'admin', 'agent'))`
-- constraint on org_members). Same caveat as every other file here: this is
-- a testing/dev-setup aid, not shipped application schema.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Convert existing data first, then tighten the constraint ───────────
update org_members set role = 'admin' where role = 'owner';

-- Drop whatever the auto-generated constraint name actually is on your
-- database — Postgres names an inline column check `<table>_<column>_check`
-- by default, but confirm with:
--   select conname from pg_constraint where conrelid = 'org_members'::regclass;
-- if this DROP fails.
alter table org_members drop constraint if exists org_members_role_check;
alter table org_members add constraint org_members_role_check check (role in ('admin', 'agent'));
