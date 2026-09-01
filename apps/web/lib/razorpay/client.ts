import "server-only";
import Razorpay from "razorpay";

let client: Razorpay | null = null;

/** Lazy singleton, same pattern as getOpenAI()/createSupabaseAdminClient(). */
export function getRazorpayClient(): Razorpay {
  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return client;
}

/**
 * Billing cycles to pass as `total_count` when creating a subscription —
 * this SDK's Create Subscription request requires either `total_count` or
 * `end_at`, and the installed `razorpay` package's types only expose
 * `total_count` (no `end_at` on the create body), so "bill until
 * cancelled" is approximated with a cycle count long enough that hitting
 * it in practice is not a real concern: 10 years of monthly billing, 20
 * years of yearly. The addon-seat subscription always bills monthly
 * (see packages/shared/src/plans.ts — ADDONS.seat has no interval of its
 * own), so it uses the monthly count too.
 */
export const TOTAL_COUNT_BY_INTERVAL = {
  monthly: 120,
  yearly: 20,
} as const;
