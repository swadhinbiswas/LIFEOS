import { describe, expect, it } from "vitest";

import { reviewStreak } from "./streak";

const day = (iso: string): Date => new Date(`${iso}T12:00:00.000Z`);

// Wednesday 2026-09-23; the Monday of its week is 2026-09-21.
const NOW = day("2026-09-23");

const weekly = (...days: string[]) =>
  days.map((key) => ({ period: "weekly", completed_at: day(key) }));

describe("reviewStreak (ADR-104)", () => {
  it("counts consecutive weeks up to this one", () => {
    const streak = reviewStreak(
      weekly("2026-09-21", "2026-09-14", "2026-09-07"),
      NOW,
      "UTC",
      "mon",
    );
    expect(streak).toBe(3);
  });

  it("treats the current week as grace, so Monday does not zero a live streak", () => {
    // No review yet this week: the streak is the three weeks before it, not zero.
    const streak = reviewStreak(
      weekly("2026-09-14", "2026-09-07", "2026-09-01"),
      NOW,
      "UTC",
      "mon",
    );
    expect(streak).toBe(3);
  });

  it("breaks on the first genuinely missed week", () => {
    const streak = reviewStreak(weekly("2026-09-21", "2026-09-07"), NOW, "UTC", "mon");
    expect(streak).toBe(1);
  });

  it("ignores monthly reviews and unfinished rows", () => {
    const rows = [
      ...weekly("2026-09-21", "2026-09-14"),
      { period: "monthly", completed_at: day("2026-09-15") },
      { period: "weekly", completed_at: null },
    ];
    expect(reviewStreak(rows, NOW, "UTC", "mon")).toBe(2);
  });

  it("is zero for someone who has never reviewed", () => {
    expect(reviewStreak([], NOW, "UTC", "mon")).toBe(0);
  });

  it("follows the user's week start", () => {
    // With a Sunday start, 2026-09-20 belongs to the week that began on the 20th.
    const streak = reviewStreak(weekly("2026-09-20", "2026-09-13"), NOW, "UTC", "sun");
    expect(streak).toBe(2);
  });
});
