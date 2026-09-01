import { describe, it, expect } from "vitest";
import { matchWorkflowRule } from "./workflow-manager";
import type { WorkflowRule } from "@velobot/shared";

function rule(overrides: Partial<WorkflowRule>): WorkflowRule {
  return {
    id: overrides.id ?? "rule-1",
    bot_id: "bot-1",
    name: "Test rule",
    trigger_type: "keyword",
    trigger_value: "refund",
    action_type: "escalate",
    action_value: null,
    enabled: true,
    position: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("matchWorkflowRule", () => {
  it("matches a case-insensitive substring", () => {
    const r = rule({ trigger_value: "refund" });
    expect(matchWorkflowRule([r], "I want a REFUND please")).toBe(r);
  });

  it("matches any of several comma-separated keywords", () => {
    const r = rule({ trigger_value: "refund, cancel subscription, chargeback" });
    expect(matchWorkflowRule([r], "please cancel subscription now")).toBe(r);
  });

  it("returns null when nothing matches", () => {
    const r = rule({ trigger_value: "refund" });
    expect(matchWorkflowRule([r], "what are your hours?")).toBeNull();
  });

  it("ignores disabled rules", () => {
    const r = rule({ trigger_value: "refund", enabled: false });
    expect(matchWorkflowRule([r], "I want a refund")).toBeNull();
  });

  it("picks the lowest-position rule when multiple match", () => {
    const second = rule({ id: "second", trigger_value: "refund", position: 1 });
    const first = rule({ id: "first", trigger_value: "refund", position: 0 });
    // Deliberately pushed in reverse order — position, not array order, decides.
    expect(matchWorkflowRule([second, first], "I want a refund")).toBe(first);
  });
});
