import { describe, expect, it } from "vitest";

import { endOfUtcDay, startOfUtcDay, weekKey } from "./windows";

describe("notification windows (spec 6.9, adr-047)", () => {
  it("bounds a day at its UTC start and the next start", () => {
    const start = startOfUtcDay(new Date("2026-09-24T15:30:00.000Z"));
    const end = endOfUtcDay(new Date("2026-09-24T15:30:00.000Z"));
    expect(start.toISOString()).toBe("2026-09-24T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-25T00:00:00.000Z");
  });

  it("keys a week by its Monday, whatever day it is asked about", () => {
    expect(weekKey(new Date("2026-09-24T12:00:00.000Z"))).toBe("2026-09-21"); // Thursday → Monday
    expect(weekKey(new Date("2026-09-21T00:00:00.000Z"))).toBe("2026-09-21"); // Monday maps to itself
    expect(weekKey(new Date("2026-09-20T23:59:59.000Z"))).toBe("2026-09-14"); // Sunday belongs to the previous
  });
});
