-- ─────────────────────────────────────────────────────────────────────────
-- VeloBot — incremental dev/test setup for the Pricing & Subscription module
--
-- Run this AFTER supabase/sql/dev_setup.sql and
-- supabase/sql/002_platform_admin_and_queues.sql. Same caveat as those
-- files: a testing/dev-setup aid, not shipped application schema — see
-- packages/shared/src/types/database.ts for the contract this implements.
--
-- Renames the tier vocabulary: organizations.plan goes from
-- free|pro|enterprise to free|hobby|growth|business. If you have existing
-- rows using the old values, map them first, e.g.:
--   update organizations set plan = 'growth' where plan = 'pro';
--   update organizations set plan = 'business' where plan = 'enterprise';
-- ─────────────────────────────────────────────────────────────────────────

-- ── Tier vocabulary ─────────────────────────────────────────────────────
alter table organizations drop constraint if exists organizations_plan_check;
alter table organizations add constraint organizations_plan_check
  check (plan in ('free', 'hobby', 'growth', 'business'));

-- ── New billing columns ─────────────────────────────────────────────────
alter table organizations add column billing_interval text not null default 'monthly'
  check (billing_interval in ('monthly', 'yearly'));
alter table organizations add column currency text not null default 'USD'
  check (currency in ('USD', 'INR'));
alter table organizations add column payment_status text not null default 'active'
  check (payment_status in ('active', 'past_due'));
alter table organizations add column current_period_start timestamptz;
alter table organizations add column current_period_end timestamptz;
alter table organizations add column addon_seats_subscription_id text;
-- Bonus AI-message pool bought on top of the plan's base monthly allowance
-- — the one usage figure that's a real stored counter rather than derived
-- from existing rows (see lib/billing/usage.ts).
alter table organizations add column addon_message_balance integer not null default 0;
-- Extra seats bought on top of the plan's base seats_limit.
alter table organizations add column addon_seats integer not null default 0;

-- ── Stripe webhook idempotency ──────────────────────────────────────────
-- Stripe retries webhook deliveries on non-2xx responses and can otherwise
-- redeliver — without this, a retried event could double-credit an add-on
-- or double-apply a plan change.
create table processed_webhook_events (
  event_id    text primary key,
  created_at  timestamptz not null default now()
);

-- No RLS policy needed here — this table is only ever touched by the
-- service-role client inside the webhook route handler, never by the
-- RLS-scoped client, so the default (RLS enabled, zero policies, fully
-- denied to anon/authenticated) is exactly right. Enabled for defense in
-- depth, matching every other table in this project.
alter table processed_webhook_events enable row level security;
