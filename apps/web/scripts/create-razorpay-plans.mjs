// One-time setup helper: creates every Razorpay Plan this app needs (one
// per paid tier x interval x currency, plus the seat add-on) via the API,
// then prints the RAZORPAY_PLAN_* env block ready to paste into .env —
// removes the error-prone step of clicking through the Razorpay dashboard
// 14 times by hand.
//
// Usage (from apps/web):
//   node --env-file=.env.local scripts/create-razorpay-plans.mjs
//
// NOT idempotent — Razorpay has no "get or create by name" for Plans, so
// rerunning this creates duplicate Plans. Run it once per Razorpay
// account/mode (test vs. live), save the printed output, done.
//
// Prices here are duplicated from packages/shared/src/plans.ts rather than
// imported (this is a plain Node script, and that package is TS source
// with no build step) — keep the two in sync if pricing ever changes.

import Razorpay from "razorpay";

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
if (!KEY_ID || !KEY_SECRET) {
  console.error("Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET.");
  console.error("Run with (from apps/web): node --env-file=.env.local scripts/create-razorpay-plans.mjs");
  process.exit(1);
}

const razorpay = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });

// Mirrors packages/shared/src/plans.ts PLANS[tier].pricing.
const PLAN_PRICES = {
  hobby: { monthly: { USD: 19, INR: 999 }, yearly: { USD: 190, INR: 9990 } },
  growth: { monthly: { USD: 49, INR: 2499 }, yearly: { USD: 490, INR: 24990 } },
  business: { monthly: { USD: 149, INR: 7999 }, yearly: { USD: 1490, INR: 79990 } },
};
// Mirrors packages/shared/src/plans.ts ADDONS.seat — always monthly.
const ADDON_SEAT_PRICE = { USD: 10, INR: 499 };

const PERIOD_BY_INTERVAL = { monthly: "monthly", yearly: "yearly" };

async function createPlan(envName, name, amount, currency, period) {
  const plan = await razorpay.plans.create({
    period,
    interval: 1,
    item: { name, amount: amount * 100, currency },
  });
  console.log(`${envName}=${plan.id}`);
}

async function main() {
  console.log("# Paste this block into .env — see .env.example for context.\n");

  for (const [tier, byInterval] of Object.entries(PLAN_PRICES)) {
    for (const [interval, byCurrency] of Object.entries(byInterval)) {
      for (const [currency, amount] of Object.entries(byCurrency)) {
        const envName = `RAZORPAY_PLAN_${tier.toUpperCase()}_${interval.toUpperCase()}_${currency}`;
        await createPlan(envName, `VeloBot ${tier} (${interval}, ${currency})`, amount, currency, PERIOD_BY_INTERVAL[interval]);
      }
    }
  }

  for (const [currency, amount] of Object.entries(ADDON_SEAT_PRICE)) {
    const envName = `RAZORPAY_PLAN_ADDON_SEAT_${currency}`;
    await createPlan(envName, `VeloBot extra agent seat (${currency})`, amount, currency, "monthly");
  }

  console.log("\n# No plan needed for the one-time messages add-on — it's a plain Order with an inline amount.");
}

main().catch((err) => {
  console.error("Failed to create plans:", err.message ?? err);
  process.exit(1);
});
