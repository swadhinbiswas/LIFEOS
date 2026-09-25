import { describe, expect, it } from "vitest";

import { assertWithinLimit, can, limit, planFor } from "./entitlements";

/**
 * While `BILLING_ENABLED=false` the free plan is unlimited, so nothing is gated (spec §11, ADR-080).
 */
describe("entitlements (spec §11, adr-080)", () => {
  it("grants every feature on the free plan while billing is off", async () => {
    expect(await planFor("user-1")).toMatchObject({ id: "free" });
    for (const feature of ["ai", "mcp", "api", "exports"] as const) {
      expect(await can("user-1", feature)).toBe(true);
    }
  });

  it("reports unlimited limits rather than a number", async () => {
    expect(await limit("user-1", "boards")).toBe(Number.POSITIVE_INFINITY);
    expect(await limit("user-1", "aiMessagesPerMonth")).toBe(Number.POSITIVE_INFINITY);
  });

  it("never throws at the ceiling while limits are unlimited", async () => {
    await expect(assertWithinLimit("user-1", "cards", 10_000_000)).resolves.toBeUndefined();
  });
});
