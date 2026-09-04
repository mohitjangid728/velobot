-- ─────────────────────────────────────────────────────────────────────────
-- VeloBot — plan-expiry reminder email. Since plan purchases are one-time
-- Razorpay Orders rather than auto-renewing Subscriptions (see
-- apps/web/app/api/razorpay/checkout/route.ts's doc comment), nothing
-- else ever revisits an org once its current_period_end passes — this
-- column is what lets supabase/functions/plan-expiry-watcher send exactly
-- one reminder per billing period rather than re-sending on every run
-- until the org renews.
--
-- Run this in the Supabase SQL Editor, then set up the cron schedule at
-- the bottom (edit the two <PLACEHOLDER> values first) so
-- plan-expiry-watcher actually gets invoked — creating the function via
-- `supabase functions deploy plan-expiry-watcher` is a separate, CLI-side
-- step this file doesn't cover.
-- ─────────────────────────────────────────────────────────────────────────

alter table organizations add column expiry_reminder_sent_at timestamptz;

-- Requires the pg_cron and pg_net extensions (already enabled for you if
-- supabase/functions/escalation-watcher's own cron job is running).
-- select cron.schedule(
--   'plan-expiry-watcher',
--   '0 9 * * *', -- once daily at 09:00 UTC
--   $$ select net.http_post(
--        url := '<YOUR_SUPABASE_PROJECT_URL>/functions/v1/plan-expiry-watcher',
--        headers := jsonb_build_object('Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>')
--      ) $$
-- );
