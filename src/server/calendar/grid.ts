import { dayKey, dayRange, shiftDay } from "@/server/habits/streak";

/**
 * Calendar grid maths (spec §6.9 / #24, ADR-052). Pure so the weeks a month view draws can be
 * unit-tested without a database, and every key is a UTC `YYYY-MM-DD` day (ADR-045).
 */

export type CalendarView = "month" | "week" | "agenda";

export const CALENDAR_VIEWS: readonly CalendarView[] = ["month", "week", "agenda"];

/** Monday first, matching the week grid. */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const isValidDayKey = (value: string | undefined): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));

const parts = (key: string): [number, number, number] => {
  const [y, m, d] = key.split("-").map(Number);
  return [y ?? 1970, m ?? 1, d ?? 1];
};

/** Monday-based weekday index, 0..6. */
export function weekdayIndex(key: string): number {
  const [y, m, d] = parts(key);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** The Monday of the week containing `key`. */
export const weekStart = (key: string): string => shiftDay(key, -weekdayIndex(key));

/** Monday..Sunday of the week containing `key`. */
export function weekDays(key: string): string[] {
  const start = weekStart(key);
  return dayRange(start, shiftDay(start, 6));
}

/** Every day cell a month view draws: whole weeks covering the month of `key`. */
export function monthGrid(key: string): string[] {
  const [year, month] = parts(key);
  const pad = (value: number) => String(value).padStart(2, "0");
  const first = `${String(year).padStart(4, "0")}-${pad(month)}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = `${String(year).padStart(4, "0")}-${pad(month)}-${pad(lastDay)}`;
  return dayRange(weekStart(first), shiftDay(weekStart(last), 6));
}

/** `YYYY-MM` of a day key — what the month cells compare against to dim adjacent months. */
export const monthOf = (key: string): string => key.slice(0, 7);

/** The first of the month `delta` months away, so a 31st never rolls into the wrong month. */
export function shiftMonth(key: string, delta: number): string {
  const [year, month] = parts(key);
  return dayKey(new Date(Date.UTC(year, month - 1 + delta, 1)));
}

/** The inclusive day range a view needs to query. */
export function rangeFor(view: CalendarView, anchor: string): { from: string; to: string } {
  if (view === "week") {
    const days = weekDays(anchor);
    return { from: days[0] as string, to: days[days.length - 1] as string };
  }
  if (view === "agenda") return { from: anchor, to: shiftDay(anchor, 29) };
  const grid = monthGrid(anchor);
  return { from: grid[0] as string, to: grid[grid.length - 1] as string };
}

/** Prev/next step for a view: a month, a week, or the thirty-day agenda window. */
export function stepAnchor(view: CalendarView, anchor: string, delta: number): string {
  if (view === "month") return shiftMonth(anchor, delta);
  return shiftDay(anchor, view === "week" ? 7 * delta : 30 * delta);
}

export function monthLabel(key: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${key}T00:00:00.000Z`));
}
