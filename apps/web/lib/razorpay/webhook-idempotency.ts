import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Same insert-and-catch-unique-violation trick the Stripe webhook used
 * (inline there; extracted here since it's identical and now shared by
 * the webhook route AND worth keeping separately testable). Keyed by
 * Razorpay's `X-Razorpay-Event-Id` header, which Razorpay documents as
 * unique per event — no payload-internal id to fall back on.
 */
export async function alreadyProcessedEvent(eventId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("processed_webhook_events").insert({ event_id: eventId });
  return !!error;
}
