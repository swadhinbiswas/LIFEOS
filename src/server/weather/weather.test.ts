import { describe, expect, it } from "vitest";

import { describe as describeCode, MAX_AGE_MS } from "./index";

/**
 * The WMO mapping (ADR-132).
 *
 * Pure functions over the provider's code, so they can be checked without a network call. The
 * grouping is the part worth pinning: a person wants "rain", not "light drizzle", and a provider
 * that adds a code tomorrow must produce a word rather than a blank.
 */
describe("weather code descriptions", () => {
  it("names the codes people actually see", () => {
    expect(describeCode(0, true)).toBe("clear");
    expect(describeCode(0, false)).toBe("clear night");
    expect(describeCode(2, true)).toBe("partly cloudy");
    expect(describeCode(3, true)).toBe("overcast");
    expect(describeCode(45, true)).toBe("fog");
    expect(describeCode(61, true)).toBe("rain");
    expect(describeCode(75, true)).toBe("snow");
    expect(describeCode(95, true)).toBe("thunderstorm");
  });

  it("groups rather than enumerates, so drizzle is not its own weather", () => {
    // WMO splits 51/53/55 and 61/63/65; a person planning a walk does not care which.
    expect(describeCode(51, true)).toBe("drizzle");
    expect(describeCode(55, true)).toBe("drizzle");
    expect(describeCode(63, true)).toBe("rain");
    expect(describeCode(65, true)).toBe("rain");
  });

  it("has a real answer for an unrecognised code instead of a blank", () => {
    // The provider adding a code tomorrow should not blank the dashboard.
    expect(describeCode(999, true)).toBe("thunderstorm");
    expect(describeCode(null, true)).toBe("unknown");
  });

  it("treats a null code as unknown rather than clear", () => {
    // 0 is clear. null is "we were not told", and rendering it as a sunny morning is a fabrication.
    expect(describeCode(null, true)).not.toBe("clear");
  });
});

describe("the cache window", () => {
  it("is half an hour, because a forecast does not change in five minutes", () => {
    expect(MAX_AGE_MS).toBe(30 * 60 * 1000);
  });
});
