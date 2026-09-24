import { describe, expect, it } from "vitest";

import {
  isValidDayKey,
  monthGrid,
  monthLabel,
  monthOf,
  rangeFor,
  shiftMonth,
  stepAnchor,
  weekDays,
  weekdayIndex,
} from "./grid";

describe("calendar grid maths (spec 6.9, adr-052)", () => {
  it("indexes weekdays Monday-first and finds the week", () => {
    expect(weekdayIndex("2026-09-21")).toBe(0); // Monday
    expect(weekdayIndex("2026-09-24")).toBe(3); // Thursday
    expect(weekdayIndex("2026-09-20")).toBe(6); // Sunday
    expect(weekDays("2026-09-24")).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
    ]);
  });

  it("covers a month with whole weeks", () => {
    const grid = monthGrid("2026-09-15");
    expect(grid[0]).toBe("2026-08-31"); // Monday of the week holding 1 Sep
    expect(grid[grid.length - 1]).toBe("2026-10-04"); // Sunday of the week holding 30 Sep
    expect(grid).toHaveLength(35);
    expect(monthOf("2026-08-31")).toBe("2026-08");
  });

  it("ranges each view and steps without rolling a 31st into the wrong month", () => {
    expect(rangeFor("week", "2026-09-24")).toEqual({ from: "2026-09-21", to: "2026-09-27" });
    expect(rangeFor("month", "2026-09-15")).toEqual({ from: "2026-08-31", to: "2026-10-04" });
    expect(rangeFor("agenda", "2026-09-24")).toEqual({ from: "2026-09-24", to: "2026-10-23" });

    expect(shiftMonth("2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftMonth("2026-01-15", -1)).toBe("2025-12-01");
    expect(stepAnchor("week", "2026-09-24", 1)).toBe("2026-10-01");
    expect(stepAnchor("agenda", "2026-09-24", -1)).toBe("2026-08-25");
  });

  it("labels a month and rejects malformed day keys", () => {
    expect(monthLabel("2026-09-24")).toBe("September 2026");
    expect(isValidDayKey("2026-09-24")).toBe(true);
    expect(isValidDayKey("2026-9-24")).toBe(false);
    expect(isValidDayKey(undefined)).toBe(false);
  });
});
