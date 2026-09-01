-- ─────────────────────────────────────────────────────────────────────────
-- VeloBot — switch the billing gateway from Stripe to Razorpay.
-- Implements the contract in packages/shared/src/types/database.ts
-- (Organization.razorpay_customer_id / razorpay_subscription_id, renamed
-- from stripe_customer_id / stripe_subscription_id).
--
-- A rename, not a drop+recreate — strictly safer, and this codebase has no
-- real production Stripe subscriptions to migrate away from at this point.
-- `addon_seats_subscription_id`, `payment_status`, `current_period_start/end`,
-- `addon_message_balance`, `addon_seats`, `seats_limit`, `plan`,
-- `billing_interval`, `currency` were already gateway-agnostic in name and
-- need no change — they now just hold Razorpay-sourced values.
--
-- Run this AFTER supabase/sql/009_launch_readiness.sql.
-- ─────────────────────────────────────────────────────────────────────────

alter table organizations rename column stripe_customer_id to razorpay_customer_id;
alter table organizations rename column stripe_subscription_id to razorpay_subscription_id;
