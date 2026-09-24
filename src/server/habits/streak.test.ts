import { describe, expect, it } from "vitest";

import { computeStreak, dayRange, recentDays, shiftDay, targetProgress } from "./streak";

const TODAY = "2026-09-24";

describe("habit streak rules (spec 6.4)", () => {
  it("counts consecutive days ending today", () => {
    const done = new Set(["2026-09-24", "2026-09-23", "2026-09-22"]);
    expect(computeStreak(done, TODAY)).toBe(3);
  });

  it("does not break a streak because today is not done yet", () => {
    const done = new Set(["2026-09-23", "2026-09-22"]);
    expect(computeStreak(done, TODAY)).toBe(2);
  });

  it("forgives a single missed day, but not two in a row (never miss twice)", () => {
    // 21 done, 22 missed, 23 and 24 done -> one miss is forgiven.
    expect(
      computeStreak(new Set(["2026-09-24", "2026-09-23", "2026-09-21"]), TODAY, { graceDays: 1 }),
    ).toBe(3);

    // 22 and 23 both missed -> the streak ends at today.
    expect(computeStreak(new Set(["2026-09-24", "2026-09-21"]), TODAY, { graceDays: 1 })).toBe(1);
  });

  it("spends freeze days before grace", () => {
    // 24 done, 23 and 22 missed, 21 done: one freeze plus one grace reaches 21.
    expect(computeStreak(new Set(["2026-09-24", "2026-09-21"]), TODAY, { freezeDays: 1 })).toBe(2);
    // Without the freeze the same history is only the 24th.
    expect(computeStreak(new Set(["2026-09-24", "2026-09-21"]), TODAY)).toBe(1);
  });

  it("is zero when nothing was ever logged", () => {
    expect(computeStreak(new Set(), TODAY)).toBe(0);
  });

  it("moves day keys safely across month and year boundaries", () => {
    expect(shiftDay("2026-09-01", -1)).toBe("2026-08-31");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
    expect(dayRange("2026-09-29", "2026-10-02")).toEqual([
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
  });

  it("builds the recent-days window newest last", () => {
    const window = recentDays(new Map([["2026-09-24", 8]]), TODAY, 3);
    expect(window.map((day) => day.key)).toEqual(["2026-09-22", "2026-09-23", "2026-09-24"]);
    expect(window.at(-1)).toEqual({ key: "2026-09-24", done: true, value: 8 });
  });

  it("computes target progress without inventing a denominator", () => {
    expect(targetProgress(4, 8)).toBe(50);
    expect(targetProgress(9, 8)).toBe(100);
    expect(targetProgress(1, null)).toBe(100);
    expect(targetProgress(0, null)).toBe(0);
  });
});
