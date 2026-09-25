import { describe, expect, it } from "vitest";

import { escapeIcs, toIcs } from "./ics";
import type { CalendarEvent } from ".";

/**
 * The iCalendar export must be a valid envelope with the right value types (spec §9.3): date-only
 * items as all-day events, timed items as UTC instants, and text escaped per RFC 5545.
 */
const base = { kind: "task" as const, href: "/tasks?card=1" };

describe("toIcs", () => {
  it("wraps events in a CRLF calendar envelope", () => {
    const ics = toIcs([], { now: new Date("2026-09-25T12:00:00Z") });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("X-WR-CALNAME:LifeOS");
  });

  it("exports a date-only event as an all-day event with an exclusive end", () => {
    const event: CalendarEvent = {
      ...base,
      id: "task:1",
      title: "Ship the report",
      at: "2026-09-26T00:00:00.000Z",
      date: "2026-09-26",
      time: null,
    };
    const ics = toIcs([event], { now: new Date("2026-09-25T12:00:00Z") });
    expect(ics).toContain("DTSTART;VALUE=DATE:20260926");
    expect(ics).toContain("DTEND;VALUE=DATE:20260927");
    expect(ics).toContain("UID:task:1@lifeos");
  });

  it("exports a timed event as a UTC instant with a duration", () => {
    const event: CalendarEvent = {
      ...base,
      id: "interview:9",
      kind: "interview",
      title: "Northwind · screen",
      at: "2026-09-26T13:00:00.000Z",
      date: "2026-09-26",
      time: "13:00",
      href: "/career/jobs/7",
    };
    const ics = toIcs([event], {
      now: new Date("2026-09-25T12:00:00Z"),
      origin: "https://lifeos.example",
    });
    expect(ics).toContain("DTSTART:20260926T130000Z");
    expect(ics).toContain("DURATION:PT30M");
    expect(ics).toContain("URL:https://lifeos.example/career/jobs/7");
  });

  it("escapes commas, semicolons and newlines in text", () => {
    expect(escapeIcs("a, b; c\nd")).toBe("a\\, b\\; c\\nd");
  });
});
