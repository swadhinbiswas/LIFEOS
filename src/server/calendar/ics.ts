import { shiftDay } from "@/server/habits/streak";

import type { CalendarEvent } from ".";

/**
 * iCalendar export (spec §9.3, ADR-052): the calendar's own events rendered as an `.ics` file. Pure,
 * so the route and the tests agree. Date-only events export as all-day (`VALUE=DATE`) and timed ones
 * as UTC instants, which is what a calendar client expects for each.
 */

const pad = (value: number): string => String(value).padStart(2, "0");

/** `YYYYMMDDTHHMMSSZ` in UTC. */
const stamp = (date: Date): string =>
  `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(
    date.getUTCHours(),
  )}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;

/** RFC 5545 text escaping: backslash, semicolon, comma and newlines. */
export const escapeIcs = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Fold a content line at 73 characters, continuation lines carrying a leading space. */
const fold = (line: string): string => {
  if (line.length <= 73) return line;
  const parts: string[] = [];
  for (let index = 0; index < line.length; index += 73) parts.push(line.slice(index, index + 73));
  return parts.join("\r\n ");
};

export interface IcsOptions {
  /** `DTSTAMP` for every event, and the default for nothing else. */
  now: Date;
  /** Absolute origin for event URLs, e.g. `https://lifeos.example`. */
  origin?: string;
  /** Calendar name shown by the client. */
  name?: string;
}

export function toIcs(events: CalendarEvent[], options: IcsOptions): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LifeOS//LifeOS//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(options.name ?? "LifeOS")}`,
  ];

  const now = stamp(options.now);

  for (const event of events) {
    lines.push("BEGIN:VEVENT", `UID:${event.id}@lifeos`, `DTSTAMP:${now}`);
    if (event.time === null) {
      lines.push(
        `DTSTART;VALUE=DATE:${event.date.replace(/-/g, "")}`,
        `DTEND;VALUE=DATE:${shiftDay(event.date, 1).replace(/-/g, "")}`,
      );
    } else {
      lines.push(`DTSTART:${stamp(new Date(event.at))}`, "DURATION:PT30M");
    }
    lines.push(`SUMMARY:${escapeIcs(event.title)}`);
    if (options.origin) lines.push(`URL:${options.origin}${event.href}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
