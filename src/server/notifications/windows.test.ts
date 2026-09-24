import { describe, expect, it } from "vitest";

import { weekKey } from "./windows";

describe("notification windows (spec 6.9, adr-047)", () => {
  it("keys a week by its Monday, whatever day it is asked about", () => {
    expect(weekKey(new Date("2026-09-24T12:00:00.000Z"))).toBe("2026-09-21"); // Thursday → Monday
    expect(weekKey(new Date("2026-09-21T00:00:00.000Z"))).toBe("2026-09-21"); // Monday maps to itself
    expect(weekKey(new Date("2026-09-20T23:59:59.000Z"))).toBe("2026-09-14"); // Sunday belongs to the previous
  });
});
