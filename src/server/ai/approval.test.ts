import { describe, expect, it } from "vitest";

import { approvalFor } from "./approval";
import { parseAiPrefs } from "./prefs";
import { AUTO_APPROVABLE_TOOLS, findToolSpec, TOOL_SPECS } from "./tools/catalog";

describe("AI approval policy (spec §8, adr-076)", () => {
  it("lets read tools run freely", () => {
    expect(approvalFor("search", [])).toBe("not-applicable");
    expect(approvalFor("get_daily_brief", [])).toBe("not-applicable");
  });

  it("requires approval for every write tool by default", () => {
    expect(approvalFor("move_card", [])).toBe("user-approval");
    expect(approvalFor("create_card", [])).toBe("user-approval");
  });

  it("auto-approves only allowlisted low-risk writes", () => {
    expect(approvalFor("create_card", ["create_card"])).toBe("approved");
    expect(approvalFor("log_habit", ["log_habit"])).toBe("approved");
    // A write that is not on the auto-approve list stays gated.
    expect(approvalFor("move_card", ["create_card"])).toBe("user-approval");
  });

  it("never auto-approves a destructive tool, even if the allowlist asks", () => {
    expect(approvalFor("delete_card", ["delete_card"])).toBe("user-approval");
    const spec = findToolSpec("delete_card");
    expect(spec?.risk).toBe("destructive");
    expect(spec?.autoApprovable).toBeUndefined();
  });

  it("fails closed for an unknown tool", () => {
    const decision = approvalFor("rm_rf", []);
    expect(decision).toEqual({ type: "denied", reason: "unknown tool: rm_rf" });
  });

  it("only marks low-risk writes as auto-approvable in the catalogue", () => {
    expect([...AUTO_APPROVABLE_TOOLS].sort()).toEqual(["create_card", "log_habit"]);
    for (const tool of TOOL_SPECS) {
      if (tool.autoApprovable) expect(tool.risk).toBe("write");
    }
  });
});

describe("AI preferences (adr-073)", () => {
  it("falls back to defaults for missing or corrupt JSON", () => {
    // The whole object is pinned, not a subset, so adding a preference fails here until someone
    // decides what its default is. That is the point: `commandCodeZdr` arrived as `false` for a
    // stated reason (ADR-134 — ZDR is a routing constraint, and defaulting it on would mean some
    // requests start failing with a 422), and this assertion is what makes that a decision.
    const defaults = parseAiPrefs(null);
    expect(defaults).toEqual({
      autoApprove: [],
      memoryEnabled: false,
      morningBrief: "off",
      fridayReview: false,
      commandCodeZdr: false,
    });
    expect(parseAiPrefs("{not json")).toEqual(defaults);
    expect(parseAiPrefs(JSON.stringify({ autoApprove: ["delete_card"] }))).toEqual(defaults);
  });

  it("keeps a valid allowlist and drops unknown providers", () => {
    const prefs = parseAiPrefs(
      JSON.stringify({ provider: "openai", model: "gpt-5-mini", autoApprove: ["create_card"] }),
    );
    expect(prefs.provider).toBe("openai");
    expect(prefs.autoApprove).toEqual(["create_card"]);
  });
});
