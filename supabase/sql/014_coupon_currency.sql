-- ─────────────────────────────────────────────────────────────────────────
-- VeloBot — a `fixed` (flat-amount) coupon needs a currency: "$10 off"
-- and "₹10 off" are wildly different discounts, so applying a coupon's
-- discount_value the same way regardless of the purchase's currency was a
-- real bug. `percent` coupons are unaffected by currency, so this column
-- is only ever read (and required, at creation time) for `fixed` coupons
-- — see lib/billing/coupons.ts's validateCoupon().
-- ─────────────────────────────────────────────────────────────────────────

alter table coupons add column currency text check (currency in ('USD', 'INR'));
