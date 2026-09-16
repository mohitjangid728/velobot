import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeQueryResult, makeMockAdminClient } from "@/lib/test-utils/mock-supabase-admin";
import type { Organization } from "@velobot/shared";

const mockAdmin = vi.hoisted(() => ({ client: null as ReturnType<typeof makeMockAdminClient> | null }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => mockAdmin.client,
}));

vi.mock("@/lib/billing/usage", () => ({
  getBotCount: vi.fn(),
  getPagesIndexed: vi.fn(),
  getMessagesUsedThisPeriod: vi.fn(),
  getActiveMemberCount: vi.fn(),
  getPeriodStart: vi.fn(() => new Date()),
}));

import { assertCanCreateBot, assertCanIngestPages, assertCanSendAiMessage, assertHasCapability } from "@/lib/billing/guards";
import { getBotCount, getMessagesUsedThisPeriod, getPagesIndexed } from "@/lib/billing/usage";

function org(overrides: Partial<Organization>): Organization {
  return {
    id: "org-1",
    name: "Acme",
    slug: "acme",
    plan: "hobby",
    billing_interval: "monthly",
    currency: "USD",
    payment_status: "active",
    current_period_start: null,
    current_period_end: null,
    razorpay_customer_id: null,
    razorpay_subscription_id: null,
    addon_seats_subscription_id: null,
    addon_message_balance: 0,
    addon_seats: 0,
    seats_limit: 1,
    suspended_at: null,
    created_at: new Date().toISOString(),
    expiry_reminder_sent_at: null,
    ...overrides,
  };
}

/** guards.ts always queries plan_overrides right after organizations (loadOrgAndPlan) — every test here uses the static defaults, so that query always resolves to "no override row." */
function mockClientFor(organization: Organization) {
  return makeMockAdminClient({
    organizations: makeQueryResult({ data: organization }),
    plan_overrides: makeQueryResult({ data: null }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("assertCanCreateBot", () => {
  it("blocks bot creation at the plan's bot limit (hobby: 2)", async () => {
    mockAdmin.client = mockClientFor(org({ plan: "hobby" }));
    vi.mocked(getBotCount).mockResolvedValue(2);
    const result = await assertCanCreateBot("org-1");
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Hobby plan allows up to 2/);
  });

  it("allows bot creation below the limit", async () => {
    mockAdmin.client = mockClientFor(org({ plan: "hobby" }));
    vi.mocked(getBotCount).mockResolvedValue(1);
    const result = await assertCanCreateBot("org-1");
    expect(result.allowed).toBe(true);
  });

  it("uses a Super-Admin-edited quota override instead of the static default", async () => {
    mockAdmin.client = makeMockAdminClient({
      organizations: makeQueryResult({ data: org({ plan: "hobby" }) }),
      // Hobby's static bot quota is 2 — an override bumps it to 10.
      plan_overrides: makeQueryResult({ data: { tier: "hobby", quota_bots: 10 } }),
    });
    vi.mocked(getBotCount).mockResolvedValue(5);
    const result = await assertCanCreateBot("org-1");
    expect(result.allowed).toBe(true);
  });
});

describe("assertCanIngestPages", () => {
  it("clamps an oversized request down to remaining headroom instead of rejecting it outright — the crawl route's max_pages is an arbitrary safety cap, not a real ask for that many pages", async () => {
    mockAdmin.client = mockClientFor(org({ plan: "free" })); // free tier page limit: 20
    vi.mocked(getPagesIndexed).mockResolvedValue(0);
    const result = await assertCanIngestPages("org-1", 150);
    expect(result.allowed).toBe(true);
    expect(result.allowedPages).toBe(20);
  });

  it("returns the full requested amount when it fits within headroom", async () => {
    mockAdmin.client = mockClientFor(org({ plan: "free" }));
    vi.mocked(getPagesIndexed).mockResolvedValue(0);
    const result = await assertCanIngestPages("org-1", 5);
    expect(result.allowed).toBe(true);
    expect(result.allowedPages).toBe(5);
  });

  it("blocks only once there's zero headroom left", async () => {
    mockAdmin.client = mockClientFor(org({ plan: "free" }));
    vi.mocked(getPagesIndexed).mockResolvedValue(20);
    const result = await assertCanIngestPages("org-1", 150);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Free plan allows up to 20 indexed pages \(20 used\)/);
  });
});

describe("assertCanSendAiMessage", () => {
  it("falls back to the add-on balance once the base allowance is used up", async () => {
    mockAdmin.client = mockClientFor(org({ plan: "free", addon_message_balance: 5 }));
    vi.mocked(getMessagesUsedThisPeriod).mockResolvedValue(50); // free tier limit
    const result = await assertCanSendAiMessage("org-1");
    expect(result.allowed).toBe(true);
    expect(result.usesAddonBalance).toBe(true);
  });

  it("blocks once both the base allowance and the add-on balance are exhausted", async () => {
    mockAdmin.client = mockClientFor(org({ plan: "free", addon_message_balance: 0 }));
    vi.mocked(getMessagesUsedThisPeriod).mockResolvedValue(50);
    const result = await assertCanSendAiMessage("org-1");
    expect(result.allowed).toBe(false);
    expect(result.usesAddonBalance).toBe(false);
  });
});

describe("assertHasCapability", () => {
  it("grants apiAccess only on the business tier", async () => {
    mockAdmin.client = mockClientFor(org({ plan: "business" }));
    expect((await assertHasCapability("org-1", "apiAccess")).allowed).toBe(true);
  });

  it("denies apiAccess on every plan below business", async () => {
    mockAdmin.client = mockClientFor(org({ plan: "growth" }));
    expect((await assertHasCapability("org-1", "apiAccess")).allowed).toBe(false);
  });
});
