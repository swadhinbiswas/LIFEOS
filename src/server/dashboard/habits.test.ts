import { describe, expect, it } from "vitest";

import { constellationRows, habitConsistencySeries } from "./habits";

/** Hand-checkable fixture: the spec wants a derived number to match a fixture, not the UI. */
const days = (...keys: Array<[string, boolean, number?]>) =>
  keys.map(([key, done, value]) => ({ key, done, value: value ?? (done ? 1 : 0) }));

describe("habitConsistencySeries (spec 6.8)", () => {
  it("is the percentage of habits checked off, oldest first", () => {
    const series = habitConsistencySeries(
      [
        { days: days(["2026-09-20", true], ["2026-09-21", false], ["2026-09-22", true]) },
        { days: days(["2026-09-20", true], ["2026-09-21", true], ["2026-09-22", false]) },
      ],
      14,
    );

    expect(series).toEqual([
      { day: "2026-09-20", value: 100 },
      { day: "2026-09-21", value: 50 },
      { day: "2026-09-22", value: 50 },
    ]);
  });

  it("windows to the most recent days and never invents a day that is missing", () => {
    const series = habitConsistencySeries(
      [
        {
          days: days(
            ["2026-09-18", true],
            ["2026-09-19", true],
            ["2026-09-20", false],
            ["2026-09-21", true],
          ),
        },
      ],
      2,
    );

    expect(series.map((row) => row.day)).toEqual(["2026-09-20", "2026-09-21"]);
    expect(series.map((row) => row.value)).toEqual([0, 100]);
  });

  it("aligns habits by day key, so a shorter history cannot skew a day", () => {
    // The second habit has no 2026-09-20 row at all. Index alignment would read the *next* day's
    // value off it; key alignment counts it as not done, which is the honest answer.
    const series = habitConsistencySeries(
      [
        { days: days(["2026-09-19", true], ["2026-09-20", true]) },
        { days: days(["2026-09-21", true]) },
      ],
      14,
    );

    expect(series.find((row) => row.day === "2026-09-20")?.value).toBe(50);
  });

  it("returns nothing without habits so the chart shows an empty state", () => {
    expect(habitConsistencySeries([], 14)).toEqual([]);
  });
});

describe("constellationRows (spec 6.8)", () => {
  it("carries the 7-day strip, its values and the 28-day share", () => {
    const rows = constellationRows(
      [
        {
          id: "h1",
          name: "read",
          streak: 3,
          days: days(
            ["2026-09-19", true, 10],
            ["2026-09-20", true, 20],
            ["2026-09-21", false, 0],
            ["2026-09-22", true, 30],
          ),
        },
      ],
      3,
    );

    expect(rows).toEqual([
      {
        id: "h1",
        name: "read",
        streak: 3,
        week: [
          { key: "2026-09-20", done: true },
          { key: "2026-09-21", done: false },
          { key: "2026-09-22", done: true },
        ],
        values: [20, 0, 30],
        ratio: 0.75,
      },
    ]);
  });

  it("survives a habit with no history", () => {
    const [row] = constellationRows([{ id: "h1", name: "new", streak: 0, days: [] }]);
    expect(row?.week).toEqual([]);
    expect(row?.ratio).toBe(0);
  });
});
