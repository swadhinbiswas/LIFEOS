import { describe, expect, it } from "vitest";

import type { DaySignals } from "@/server/day";
import { correlation, summariseWeek } from "./insights";

const NAMES = { sleep: "sleep", mood: "mood", habit: "habits kept", focus: "focus time" };

const day = (over: Partial<DaySignals>): DaySignals => ({
  day: "2026-09-20",
  sleepHours: null,
  mood: null,
  habitPct: 0,
  habitDone: 0,
  habitTotal: 0,
  focusMinutes: 0,
  spentMinor: 0,
  currency: null,
  recorded: 0,
  ...over,
});

/** A run of days with sleep and mood rising together — the relationship the review should find. */
const correlated = (n: number): DaySignals[] =>
  Array.from({ length: n }, (_, i) =>
    day({ sleepHours: 5 + i * 0.5, mood: 2 + i * 0.5, habitPct: 40 + i * 5, habitTotal: 3 }),
  );

describe("correlation", () => {
  it("is 1 for a perfect line and -1 for a perfect inverse", () => {
    expect(
      correlation([
        [1, 2],
        [2, 4],
        [3, 6],
      ]),
    ).toBeCloseTo(1);
    expect(
      correlation([
        [1, 6],
        [2, 4],
        [3, 2],
      ]),
    ).toBeCloseTo(-1);
  });

  it("is null below three points, because two points always correlate perfectly", () => {
    // The real trap: any two points fit a line exactly, so r = 1 means nothing.
    expect(
      correlation([
        [1, 1],
        [2, 4],
      ]),
    ).toBeNull();
    expect(correlation([])).toBeNull();
  });

  it("is null when one side never varies, which would divide by zero", () => {
    expect(
      correlation([
        [1, 5],
        [1, 6],
        [1, 7],
      ]),
    ).toBeNull();
  });
});

describe("summariseWeek (adr-132)", () => {
  it("averages only the days that were recorded, and says how many", () => {
    const days = [
      day({ sleepHours: 6, habitPct: 50, habitTotal: 2 }),
      day({ sleepHours: 8, habitPct: 100, habitTotal: 2 }),
      // No sleep recorded. Not zero — unknown.
      day({ habitPct: 0, habitTotal: 2 }),
    ];
    const week = summariseWeek(days, NAMES);
    // 7, not 14/3: the missing night is not a zero-hour night.
    expect(week.sleep).toBe(7);
    expect(week.coverage.sleep).toBe(2);
    expect(week.coverage.habits).toBe(3);
  });

  it("reports null for a signal nobody recorded, rather than zero", () => {
    const week = summariseWeek([day({ habitPct: 100, habitTotal: 1 })], NAMES);
    expect(week.sleep).toBeNull();
    expect(week.mood).toBeNull();
  });

  it("finds sleep tracking mood, and says how many days it saw", () => {
    const week = summariseWeek(correlated(6), NAMES);
    const found = week.correlations.find((c) => c.a === "sleepHours" && c.b === "mood");
    expect(found).toBeDefined();
    expect(found?.r).toBeGreaterThan(0.9);
    expect(found?.n).toBe(6);
    expect(week.headline).toContain("6 days");
  });

  it("stays silent below four overlapping days rather than giving advice from three", () => {
    // Three days is a rumour. "Sleep doesn't seem to matter" from three data points is worse than
    // saying nothing.
    const week = summariseWeek(correlated(3), NAMES);
    expect(week.correlations).toEqual([]);
    expect(week.headline).toBeNull();
  });

  it("quotes no representative value, because there is none recorded", () => {
    const week = summariseWeek(correlated(5), NAMES);
    // The only number in the sentence is the day count. The old phrasing interpolated a "7h" sleep
    // that nobody slept and a habit score that was never recorded.
    expect(week.headline).toMatch(/^More \S.* went with more \S.* \(\d+ days\)\.$/);
    expect(week.headline).not.toMatch(/\d+\s*(h|hours|min)/);
  });

  it("names the two signals, in the direction the relationship points", () => {
    const rising = summariseWeek(correlated(5), NAMES);
    expect(rising.headline).toMatch(/^More .+ went with more /);

    // Sleep falling while mood rises: a genuine inverse. (Both falling together is r = +1, which is
    // the first fixture I wrote and the reason this test caught nothing the first time.)
    const inverse = summariseWeek(
      Array.from({ length: 5 }, (_, i) =>
        day({ sleepHours: 9 - i, mood: 2 + i * 0.5, habitPct: 100 - i * 10, habitTotal: 2 }),
      ),
      NAMES,
    );
    expect(inverse.correlations[0]?.r).toBeLessThan(0);
    // Still reads left to right, whatever the sign.
    expect(inverse.headline).toMatch(/^More /);
  });

  it("has no headline when nothing is related, which is the normal case", () => {
    const week = summariseWeek(
      // Genuinely unrelated: sleep and mood share no ordering here (r is about 0.29), and habit
      // completion is flat, which exercises the zero-variance branch as well.
      [
        day({ sleepHours: 5, mood: 2, habitPct: 50, habitTotal: 2 }),
        day({ sleepHours: 9, mood: 5, habitPct: 50, habitTotal: 2 }),
        day({ sleepHours: 4, mood: 3, habitPct: 50, habitTotal: 2 }),
        day({ sleepHours: 8, mood: 1, habitPct: 50, habitTotal: 2 }),
      ],
      NAMES,
    );
    expect(week.headline).toBeNull();
  });

  it("sums focus minutes across the run", () => {
    const week = summariseWeek(
      [day({ focusMinutes: 90 }), day({ focusMinutes: 150 }), day({})],
      NAMES,
    );
    expect(week.focusMinutes).toBe(240);
    expect(week.coverage.focus).toBe(2);
  });
});
