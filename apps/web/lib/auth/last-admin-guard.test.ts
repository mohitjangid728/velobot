import { describe, it, expect } from "vitest";
import { makeQueryResult, makeMockAdminClient } from "@/lib/test-utils/mock-supabase-admin";
import { wouldRemoveLastAdmin } from "./last-admin-guard";

describe("wouldRemoveLastAdmin", () => {
  it("is false for a non-admin target regardless of admin count", async () => {
    const admin = makeMockAdminClient({ org_members: makeQueryResult({ count: 0 }) }) as any;
    expect(await wouldRemoveLastAdmin(admin, "org-1", "agent")).toBe(false);
  });

  it("is true when the target is the org's only active admin", async () => {
    const admin = makeMockAdminClient({ org_members: makeQueryResult({ count: 1 }) }) as any;
    expect(await wouldRemoveLastAdmin(admin, "org-1", "admin")).toBe(true);
  });

  it("is false when other active admins remain", async () => {
    const admin = makeMockAdminClient({ org_members: makeQueryResult({ count: 2 }) }) as any;
    expect(await wouldRemoveLastAdmin(admin, "org-1", "admin")).toBe(false);
  });
});
