import { describe, expect, it } from "vitest";

import {
  dayKeyInTimeZone,
  endOfDayInTimeZone,
  isValidTimeZone,
  resolveTimeZone,
  resolveWeekStart,
  startOfDayInTimeZone,
  startOfWeekInTimeZone,
  startOfWeekInstant,
} from "./timezone";

describe("timezone helpers (spec 6.9, adr-057)", () => {
  it("buckets an instant into the user's day", () => {
    const late = new Date("2026-09-24T23:30:00.000Z");
    expect(dayKeyInTimeZone(late, "UTC")).toBe("2026-09-24");
    expect(dayKeyInTimeZone(late, "Asia/Kolkata")).toBe("2026-09-25"); // +05:30
    expect(dayKeyInTimeZone(late, "America/New_York")).toBe("2026-09-24"); // -04:00
  });

  it("finds a local day's start as a UTC instant", () => {
    expect(startOfDayInTimeZone("2026-09-24", "UTC").toISOString()).toBe(
      "2026-09-24T00:00:00.000Z",
    );
    expect(startOfDayInTimeZone("2026-09-24", "Asia/Kolkata").toISOString()).toBe(
      "2026-09-23T18:30:00.000Z",
    );
    expect(endOfDayInTimeZone("2026-09-24", "Asia/Kolkata").toISOString()).toBe(
      "2026-09-24T18:30:00.000Z",
    );
  });

  it("falls back to UTC for an unusable zone rather than throwing", () => {
    expect(isValidTimeZone("Asia/Dhaka")).toBe(true);
    expect(isValidTimeZone("Nowhere/Nope")).toBe(false);
    expect(resolveTimeZone("Nowhere/Nope")).toBe("UTC");
    expect(resolveTimeZone(null)).toBe("UTC");
    expect(dayKeyInTimeZone(new Date("2026-09-24T10:00:00.000Z"), "Nowhere/Nope")).toBe(
      "2026-09-24",
    );
  });

  it("anchors the week to the chosen first day", () => {
    const thursday = new Date("2026-09-24T12:00:00.000Z");
    expect(startOfWeekInTimeZone(thursday, "UTC", "mon")).toBe("2026-09-21");
    expect(startOfWeekInTimeZone(thursday, "UTC", "sun")).toBe("2026-09-20");
    expect(startOfWeekInstant(thursday, "Asia/Kolkata", "mon").toISOString()).toBe(
      "2026-09-20T18:30:00.000Z",
    );
    expect(resolveWeekStart("sun")).toBe("sun");
    expect(resolveWeekStart(null)).toBe("mon");
  });
});
