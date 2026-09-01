import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeMockAdminClient } from "@/lib/test-utils/mock-supabase-admin";

const mockAdmin = vi.hoisted(() => ({ client: null as ReturnType<typeof makeMockAdminClient> | null }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => mockAdmin.client }));

import {
  applyPlanActivation,
  applyAddonSeatActivation,
  applyAddonMessagesCredit,
  resetOrgToFree,
  clearAddonSeats,
  markPastDueBySubscription,
} from "./billing-mutations";

/** Captures the exact payload passed to `.update()` so assertions can check field-by-field. */
function makeUpdateCapturingClient(extra: Record<string, unknown> = {}) {
  const calls: { table: string; payload: unknown }[] = [];
  const client = {
    from(table: string) {
      const chain: Record<string, unknown> = {
        update: (payload: unknown) => {
          calls.push({ table, payload });
          return chain;
        },
        select: () => chain,
        eq: () => chain,
        single: () => chain,
        then: (resolve: (v: unknown) => void) => resolve(extra[table] ?? { data: null, error: null }),
      };
      return chain;
    },
  };
  return { client, calls };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("applyPlanActivation", () => {
  it("writes plan, interval, currency, seats_limit, subscription id, and period fields", async () => {
    const { client, calls } = makeUpdateCapturingClient();
    mockAdmin.client = client as unknown as ReturnType<typeof makeMockAdminClient>;

    await applyPlanActivation("org-1", {
      tier: "growth",
      interval: "yearly",
      currency: "INR",
      subscriptionId: "sub_abc",
      currentStart: 1700000000,
      currentEnd: 1731536000,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.payload).toMatchObject({
      plan: "growth",
      billing_interval: "yearly",
      currency: "INR",
      seats_limit: 3, // PLANS.growth.quota.agentSeats
      razorpay_subscription_id: "sub_abc",
      payment_status: "active",
    });
  });
});

describe("applyAddonMessagesCredit — additive", () => {
  it("adds to the existing balance rather than overwriting it", async () => {
    const { client, calls } = makeUpdateCapturingClient({ organizations: { data: { addon_message_balance: 2000 }, error: null } });
    mockAdmin.client = client as unknown as ReturnType<typeof makeMockAdminClient>;

    await applyAddonMessagesCredit("org-1", { quantity: 2 });

    // ADDONS.messages.amount is 1000 per unit — 2000 existing + 2*1000 = 4000.
    expect(calls[0]!.payload).toMatchObject({ addon_message_balance: 4000 });
  });
});

describe("applyAddonSeatActivation", () => {
  it("sets addon_seats to the subscription quantity and stores the subscription id", async () => {
    const { client, calls } = makeUpdateCapturingClient();
    mockAdmin.client = client as unknown as ReturnType<typeof makeMockAdminClient>;

    await applyAddonSeatActivation("org-1", { subscriptionId: "sub_seat", quantity: 3 });

    expect(calls[0]!.payload).toMatchObject({ addon_seats: 3, addon_seats_subscription_id: "sub_seat" });
  });
});

describe("resetOrgToFree", () => {
  it("resets plan fields and nulls the subscription id", async () => {
    const { client, calls } = makeUpdateCapturingClient();
    mockAdmin.client = client as unknown as ReturnType<typeof makeMockAdminClient>;

    await resetOrgToFree("sub_cancelled");

    expect(calls[0]!.payload).toMatchObject({
      plan: "free",
      billing_interval: "monthly",
      seats_limit: 1, // PLANS.free.quota.agentSeats
      razorpay_subscription_id: null,
      current_period_start: null,
      current_period_end: null,
      payment_status: "active",
    });
  });
});

describe("clearAddonSeats", () => {
  it("zeroes addon_seats and nulls the subscription id", async () => {
    const { client, calls } = makeUpdateCapturingClient();
    mockAdmin.client = client as unknown as ReturnType<typeof makeMockAdminClient>;

    await clearAddonSeats("sub_seat_cancelled");

    expect(calls[0]!.payload).toMatchObject({ addon_seats: 0, addon_seats_subscription_id: null });
  });
});

describe("markPastDueBySubscription", () => {
  it("sets payment_status to past_due", async () => {
    const { client, calls } = makeUpdateCapturingClient();
    mockAdmin.client = client as unknown as ReturnType<typeof makeMockAdminClient>;

    await markPastDueBySubscription("sub_abc");

    expect(calls[0]!.payload).toMatchObject({ payment_status: "past_due" });
  });
});
