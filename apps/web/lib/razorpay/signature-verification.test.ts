import { createHmac } from "crypto";
import { describe, it, expect } from "vitest";
import Razorpay from "razorpay";
import { validatePaymentVerification } from "razorpay/dist/utils/razorpay-utils";

/**
 * This app doesn't hand-roll HMAC verification — it calls the Razorpay
 * SDK's own `validateWebhookSignature`/`validatePaymentVerification`
 * (see app/api/razorpay/webhook/route.ts and .../verify/route.ts). These
 * tests exist as a contract/regression guard: if an SDK upgrade ever
 * changes what string gets hashed or how, this fails loudly instead of
 * silently accepting forged payments/webhooks in production.
 */
describe("Razorpay.validateWebhookSignature", () => {
  const secret = "whsec_test_secret";
  const body = JSON.stringify({ event: "subscription.charged", payload: {} });
  const validSignature = createHmac("sha256", secret).update(body).digest("hex");

  it("accepts a signature computed the documented way (HMAC-SHA256 of the raw body, keyed with the webhook secret)", () => {
    expect(Razorpay.validateWebhookSignature(body, validSignature, secret)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const tamperedBody = JSON.stringify({ event: "subscription.cancelled", payload: {} });
    expect(Razorpay.validateWebhookSignature(tamperedBody, validSignature, secret)).toBe(false);
  });

  it("rejects the right body with a signature computed under the wrong secret", () => {
    const wrongSecretSignature = createHmac("sha256", "a-different-secret").update(body).digest("hex");
    expect(Razorpay.validateWebhookSignature(body, wrongSecretSignature, secret)).toBe(false);
  });
});

describe("validatePaymentVerification (Checkout success-handler callback)", () => {
  const keySecret = "test_key_secret";

  it("accepts a signature over payment_id|order_id for a one-time order", () => {
    const payload = { payment_id: "pay_123", order_id: "order_456" };
    const signature = createHmac("sha256", keySecret).update(`${payload.order_id}|${payload.payment_id}`).digest("hex");
    expect(validatePaymentVerification(payload, signature, keySecret)).toBe(true);
  });

  it("accepts a signature over payment_id|subscription_id for a subscription", () => {
    const payload = { payment_id: "pay_123", subscription_id: "sub_789" };
    const signature = createHmac("sha256", keySecret).update(`${payload.payment_id}|${payload.subscription_id}`).digest("hex");
    expect(validatePaymentVerification(payload, signature, keySecret)).toBe(true);
  });

  it("rejects a signature claiming a different subscription id than what was hashed", () => {
    const signed = { payment_id: "pay_123", subscription_id: "sub_789" };
    const signature = createHmac("sha256", keySecret).update(`${signed.payment_id}|${signed.subscription_id}`).digest("hex");
    const claimed = { payment_id: "pay_123", subscription_id: "sub_attacker_controlled" };
    expect(validatePaymentVerification(claimed, signature, keySecret)).toBe(false);
  });
});
