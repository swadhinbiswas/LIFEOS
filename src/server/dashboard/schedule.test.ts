/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "@/server/calendar";

import { blockOffset, buildSchedule, formatClock, minutesInTimeZone, parseClock } from "./schedule";

/**
 * A day's blocks, built from the calendar's own events. The fixtures are UTC instants chosen so
 * their UTC time *is* the time under the fixed `UTC` zone the tests pass — no ambiguity about what
 * "09:00" means.
 */
const event = (id: string, at: string, time: string | null): CalendarEvent => ({
  id,
  kind: "task",
  title: `event ${id}`,
  at,
  date: at.slice(0, 10),
  time,
  href: `/cards/${id}`,
});

const events: CalendarEvent[] = [
  event("a", "2026-09-26T08:30:00.000Z", "08:30"),
  event("b", "2026-09-26T10:00:00.000Z", "10:00"),
  event("c", "2026-09-26T14:15:00.000Z", "14:15"),
];

const NOON = new Date("2026-09-26T12:00:00.000Z");

describe("buildSchedule (spec 6.8 time blocks)", () => {
  it("places each timed event at its own clock time", () => {
    const strip = buildSchedule(events, NOON, "UTC");
    expect(strip.timedCount).toBe(3);
    expect(strip.blocks.map((block) => block.startMinutes)).toEqual([510, 600, 855]);
  });

  it("ends a block where the next one begins, so the strip has real durations", () => {
    const strip = buildSchedule(events, NOON, "UTC");
    expect(strip.blocks[0]?.endMinutes).toBe(600);
    expect(strip.blocks[1]?.endMinutes).toBe(855);
    // The last block of the day has no successor, so it has no invented end.
    expect(strip.blocks[2]?.endMinutes).toBeNull();
  });

  it("marks what is over, what is live, and what is next", () => {
    const strip = buildSchedule(events, NOON, "UTC");
    // 08:30–10:00 has finished; 10:00–14:15 is running at noon; 14:15 is upcoming.
    expect(strip.blocks[0]?.kind).toBe("past");
    expect(strip.blocks[1]?.kind).toBe("now");
    expect(strip.blocks[2]?.kind).toBe("next");
  });

  it("names exactly one next block", () => {
    const strip = buildSchedule(events, NOON, "UTC");
    expect(strip.blocks.filter((block) => block.isNext)).toHaveLength(1);
    expect(strip.blocks[1]?.isNext).toBe(true);
  });

  it("treats the final block of the day as past once it has started", () => {
    // 16:00 with nothing after it: without the no-end rule it would read "next" forever.
    const evening = buildSchedule(
      [event("a", "2026-09-26T16:00:00.000Z", "16:00")],
      new Date("2026-09-26T18:00:00.000Z"),
      "UTC",
    );
    expect(evening.blocks[0]?.kind).toBe("past");
    expect(evening.blocks[0]?.isNext).toBe(false);
  });

  it("counts a date-only item without pretending it has an hour", () => {
    const strip = buildSchedule(
      [...events, { ...event("d", "2026-09-26T00:00:00.000Z", null), title: "all day" }],
      NOON,
      "UTC",
    );
    const untimed = strip.blocks.find((block) => block.id === "d");
    expect(untimed?.timed).toBe(false);
    expect(strip.untimedCount).toBe(1);
    expect(strip.untimed).toEqual([{ id: "d", title: "all day", href: "/cards/d" }]);
    // It must not become the "next" block, since it has no time to be next.
    expect(untimed?.isNext).toBe(false);
  });

  it("orders an untimed item last rather than at midnight", () => {
    const strip = buildSchedule(
      [
        { ...event("d", "2026-09-26T00:00:00.000Z", null) },
        event("a", "2026-09-26T09:00:00.000Z", "09:00"),
      ],
      NOON,
      "UTC",
    );
    expect(strip.blocks.map((block) => block.id)).toEqual(["a", "d"]);
  });

  it("reports an empty day as empty instead of drawing a blank axis", () => {
    const strip = buildSchedule([], NOON, "UTC");
    expect(strip.isEmpty).toBe(true);
    expect(strip.timedCount).toBe(0);
    expect(strip.blocks).toEqual([]);
  });

  it("reads the clock in the user's zone, not the server's", () => {
    // 12:00 UTC is 18:00 in Dhaka (UTC+6).
    expect(minutesInTimeZone(NOON, "UTC")).toBe(720);
    expect(minutesInTimeZone(NOON, "Asia/Dhaka")).toBe(18 * 60);
  });

  it("stays stable for equal times, so a re-render does not reshuffle", () => {
    const tied = [
      event("z", "2026-09-26T09:00:00.000Z", "09:00"),
      event("a", "2026-09-26T09:00:00.000Z", "09:00"),
    ];
    expect(buildSchedule(tied, NOON, "UTC").blocks.map((b) => b.id)).toEqual(["a", "z"]);
    expect(buildSchedule([...tied].reverse(), NOON, "UTC").blocks.map((b) => b.id)).toEqual([
      "a",
      "z",
    ]);
  });
});

describe("clock formatting", () => {
  it("round-trips minutes and clock strings", () => {
    expect(parseClock("08:30")).toBe(510);
    expect(formatClock(510)).toBe("08:30");
    expect(formatClock(0)).toBe("00:00");
  });

  it("clamps a block that runs to midnight", () => {
    expect(formatClock(25 * 60)).toBe("00:00");
    expect(blockOffset(-50)).toBe(0);
    expect(blockOffset(50_000)).toBe(1);
  });
});
