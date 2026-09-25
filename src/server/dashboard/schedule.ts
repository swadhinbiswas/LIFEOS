import type { CalendarEvent } from "@/server/calendar";
import { DEFAULT_TIME_ZONE, dayKeyInTimeZone } from "@/lib/timezone";

/**
 * Today's schedule as a time-blocked strip (spec §6.8, line 293: "schedule/time blocks").
 *
 * A personal OS that says "you have 4 things due" is less useful than one that shows the day laid
 * out. This maps the calendar events already read for the day into blocks, marks the current time,
 * and states where the blocks sit relative to now — an hour of real information rather than a
 * second list of the same titles.
 *
 * Everything here is derived from `CalendarEvent`s: the event's own `at` instant and the user's
 * timezone. Nothing is estimated, and a day with no timed items says so instead of drawing an
 * empty axis.
 */

export type BlockKind = "past" | "now" | "next";

export interface ScheduleBlock {
  id: string;
  title: string;
  href: string;
  /** Minutes from the user's local midnight. */
  startMinutes: number;
  /** Null for a date-only item, which has no time to place. */
  endMinutes: number | null;
  /** False for a date-only item, which lands at midnight and would read as "00:00". */
  timed: boolean;
  /** Where the block sits relative to `nowMinutes`, decided by the caller-facing rules below. */
  kind: BlockKind;
  /** True for the first block that has not finished — the "what next" signal. */
  isNext: boolean;
}

export interface ScheduleStrip {
  day: string;
  blocks: ScheduleBlock[];
  /** Blocks that carry a real clock time; date-only items are counted but not placed. */
  timedCount: number;
  untimedCount: number;
  /** Minutes from local midnight, or null when the caller has no trustworthy clock. */
  nowMinutes: number | null;
  /** First untimed block, the one thing with no hour attached. */
  untimed: Array<Pick<ScheduleBlock, "id" | "title" | "href">>;
  /** True when the day has nothing at all to show. */
  isEmpty: boolean;
}

const DAY_START_MINUTES = 0;
const DAY_END_MINUTES = 24 * 60;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Minutes from local midnight, read off the UTC offset rather than the runtime's own zone: the
 * caller already resolved the user's zone, and the server's clock is not in it.
 */
export function minutesInTimeZone(instant: Date, timeZone: string): number {
  // `HH:MM` in the user's zone, converted to minutes. `toLocaleString` with an explicit zone is the
  // one way to get this right without shipping a tz database.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return clamp(hour * 60 + minute, DAY_START_MINUTES, DAY_END_MINUTES);
}

/** Split an `HH:MM` string (the calendar's `time`) into minutes from midnight. */
export const parseClock = (time: string): number => {
  const [hours, minutes] = time.split(":");
  return Number(hours ?? "0") * 60 + Number(minutes ?? "0");
};

/** The block length, in minutes, from the event's own start and the next block's start. */
const endOf = (block: CalendarEvent, next: CalendarEvent | undefined): number | null => {
  const blockTime = block.time;
  if (blockTime === null) return null;
  const start = parseClock(blockTime);
  // A single event has no end of its own; the next one bounds it, and a day ends the last block.
  if (next === undefined) return null;
  const nextTime = next.time;
  if (nextTime === null) return null;
  const nextStart = parseClock(nextTime);
  return nextStart <= start ? null : nextStart;
};

export function buildSchedule(
  events: readonly CalendarEvent[],
  now: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): ScheduleStrip {
  const day = dayKeyInTimeZone(now, timeZone);
  const nowMinutes = minutesInTimeZone(now, timeZone);

  // Calendar order, then a stable order for equal times so a re-render does not reshuffle blocks.
  const ordered = [...events].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.time === null) return 1;
    if (b.time === null) return -1;
    return a.time < b.time ? -1 : a.time > b.time ? 1 : a.id < b.id ? -1 : 1;
  });

  let nextAssigned = false;
  const blocks: ScheduleBlock[] = ordered.map((event, index) => {
    const time = event.time;
    const timed = time !== null;
    const startMinutes = time === null ? DAY_START_MINUTES : parseClock(time);
    const endMinutes = timed ? endOf(event, ordered[index + 1]) : null;

    // A block counts as over once its end has passed; a block with no end (the last one of the day)
    // is over only if it started before now. Without that, the final block would stay "next"
    // forever.
    const end = endMinutes ?? (timed ? startMinutes : null);
    const over = timed && end !== null && end <= nowMinutes;
    const live =
      timed && !over && startMinutes <= nowMinutes && (endMinutes ?? DAY_END_MINUTES) > nowMinutes;

    // The first unfinished block is "next" — the one thing to do. A live block is that block.
    const isNext = !nextAssigned && timed && !over;
    if (isNext) nextAssigned = true;

    return {
      id: event.id,
      title: event.title,
      href: event.href,
      startMinutes,
      endMinutes,
      timed,
      kind: (over ? "past" : live ? "now" : "next") satisfies BlockKind,
      isNext,
    };
  });

  const timedBlocks = blocks.filter((block) => block.timed);
  const untimed = blocks
    .filter((block) => !block.timed)
    .map((block) => ({ id: block.id, title: block.title, href: block.href }));

  return {
    day,
    blocks,
    timedCount: timedBlocks.length,
    untimedCount: untimed.length,
    nowMinutes,
    untimed,
    isEmpty: blocks.length === 0,
  };
}

/** `HH:MM` in the user's locale, for a block's edge. */
export function formatClock(minutes: number): string {
  const safe = clamp(Math.round(minutes), 0, DAY_END_MINUTES);
  const hours = Math.floor(safe / 60) % 24;
  const rest = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/**
 * Where a block sits in the day, as a 0…1 offset — the strip's geometry. A day with no timed blocks
 * has no geometry to draw, which the caller renders as an empty state instead.
 */
export function blockOffset(minutes: number): number {
  return clamp(minutes / DAY_END_MINUTES, 0, 1);
}
