import { describe, it, expect } from "vitest";
import { ROLE_RANK, ROLES } from "./constants";

describe("ROLE_RANK", () => {
  it("ranks admin strictly above agent", () => {
    expect(ROLE_RANK.admin).toBeGreaterThan(ROLE_RANK.agent);
  });

  it("has exactly the two roles the owner-role removal left behind", () => {
    expect(ROLES).toEqual(["admin", "agent"]);
    expect(Object.keys(ROLE_RANK).sort()).toEqual(["admin", "agent"]);
  });
});
