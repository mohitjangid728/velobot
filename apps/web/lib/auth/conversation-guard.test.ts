import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeQueryResult, makeMockAdminClient } from "@/lib/test-utils/mock-supabase-admin";
import type { Conversation } from "@velobot/shared";

const mocks = vi.hoisted(() => ({
  client: null as ReturnType<typeof makeMockAdminClient> | null,
  user: null as { id: string } | null,
  role: null as "admin" | "agent" | null,
}));

vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => mocks.client }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: () => Promise.resolve(mocks.user),
  getRoleForOrg: () => Promise.resolve(mocks.role),
}));

import { requireConversationAccess } from "./conversation-guard";

function conversation(overrides: Partial<Conversation>): Conversation {
  return {
    id: "conv-1",
    bot_id: "bot-1",
    org_id: "org-1",
    session_id: "session-1",
    visitor_email: null,
    visitor_url: null,
    visitor_ip: null,
    visitor_location: null,
    status: "queued",
    assigned_agent_id: null,
    queued_at: null,
    assigned_at: null,
    resolved_at: null,
    last_message_at: new Date().toISOString(),
    unread_by_agent: false,
    alerted_at: null,
    queue_id: null,
    extracted_intent: null,
    extracted_sentiment: null,
    extracted_entities: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: "user-1" };
});

describe("requireConversationAccess — the queue-boundary security check", () => {
  it("rejects an unauthenticated caller", async () => {
    mocks.user = null;
    const result = await requireConversationAccess("conv-1");
    expect(result.ok).toBe(false);
  });

  it("rejects a caller with no role in the conversation's org", async () => {
    mocks.role = null;
    mocks.client = makeMockAdminClient({ conversations: makeQueryResult({ data: conversation({ queue_id: null }) }) });
    const result = await requireConversationAccess("conv-1");
    expect(result.ok).toBe(false);
  });

  it("lets an admin into a conversation routed to a queue they are NOT a member of", async () => {
    mocks.role = "admin";
    mocks.client = makeMockAdminClient({ conversations: makeQueryResult({ data: conversation({ queue_id: "queue-1" }) }) });
    const result = await requireConversationAccess("conv-1");
    expect(result.ok).toBe(true);
  });

  it("lets an agent into an unrouted (queue_id null) conversation with no queue membership row at all", async () => {
    mocks.role = "agent";
    mocks.client = makeMockAdminClient({ conversations: makeQueryResult({ data: conversation({ queue_id: null }) }) });
    const result = await requireConversationAccess("conv-1");
    expect(result.ok).toBe(true);
  });

  it("rejects an agent from a queued conversation whose queue they don't belong to", async () => {
    mocks.role = "agent";
    mocks.client = makeMockAdminClient({
      conversations: makeQueryResult({ data: conversation({ queue_id: "queue-1" }) }),
      queue_members: makeQueryResult({ data: null }), // no membership row found
    });
    const result = await requireConversationAccess("conv-1");
    expect(result.ok).toBe(false);
  });

  it("lets an agent into a queued conversation whose queue they DO belong to", async () => {
    mocks.role = "agent";
    mocks.client = makeMockAdminClient({
      conversations: makeQueryResult({ data: conversation({ queue_id: "queue-1" }) }),
      queue_members: makeQueryResult({ data: { queue_id: "queue-1" } }),
    });
    const result = await requireConversationAccess("conv-1");
    expect(result.ok).toBe(true);
  });

  it("404s when the conversation doesn't exist", async () => {
    mocks.role = "admin";
    mocks.client = makeMockAdminClient({ conversations: makeQueryResult({ data: null }) });
    const result = await requireConversationAccess("conv-missing");
    expect(result.ok).toBe(false);
  });
});
