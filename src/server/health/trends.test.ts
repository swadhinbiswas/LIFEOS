import { describe, expect, it } from "vitest";

import { kindTrends, windowDays } from "./trends";

const TODAY = "2026-09-24";
const log = (kind: string, value: number, date: string, unit: string | null = null) => ({
  kind,
  value,
  date,
  unit,
});

describe("health trends (spec 6.6)", () => {
  it("builds a day window ending today, oldest first", () => {
    const window = windowDays(TODAY, 3);
    expect(window).toEqual(["2026-09-22", "2026-09-23", "2026-09-24"]);
  });

  it("averages per kind and compares this week with last week", () => {
    const trends = kindTrends(
      [
        log("sleep", 8, "2026-09-24", "h"),
        log("sleep", 6, "2026-09-23", "h"),
        log("sleep", 7, "2026-09-10", "h"), // two weeks back: outside both weeks
        log("water", 8, "2026-09-24", "glasses"),
      ],
      TODAY,
    );

    const sleep = trends.find((trend) => trend.kind === "sleep");
    expect(sleep?.thisWeek).toBe(7); // mean of 8 and 6
    expect(sleep?.lastWeek).toBeNull();
    expect(sleep?.delta).toBeNull();
    expect(sleep?.unit).toBe("h");

    const water = trends.find((trend) => trend.kind === "water");
    expect(water?.thisWeek).toBe(8);
  });

  it("reports a delta only when both weeks have data", () => {
    const trends = kindTrends([log("mood", 4, "2026-09-24"), log("mood", 2, "2026-09-15")], TODAY);
    const mood = trends[0];
    expect(mood?.thisWeek).toBe(4);
    expect(mood?.lastWeek).toBe(2);
    expect(mood?.delta).toBe(2);
  });

  it("ignores days outside the window and never invents an average", () => {
    expect(kindTrends([log("weight", 72, "2026-01-01")], TODAY)).toEqual([]);
    expect(kindTrends([], TODAY)).toEqual([]);
  });
});
