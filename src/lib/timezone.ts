/**
 * Timezone arithmetic (spec §6.9, ADR-057). Pure and dependency-free: a user timezone is an IANA
 * name, `UTC` is the default, and every helper degrades to UTC when the name is unusable — a bad
 * row must never break a page. Instants stay UTC; only day bucketing moves.
 */

export const DEFAULT_TIME_ZONE = "UTC";

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(timeZone: string | null | undefined): string {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
}

/** `YYYY-MM-DD` for `instant` in `timeZone`. `en-CA` formats as ISO by default. */
export function dayKeyInTimeZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: resolveTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** The zone's offset from UTC at `instant`, in milliseconds. */
function offsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(instant)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24, // some environments render midnight as "24"
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - instant.getTime();
}

/**
 * Move a `YYYY-MM-DD` day key by `days` (negative goes back). Pure UTC arithmetic on the key, so a
 * day never shifts because of a timezone or a DST boundary (ADR-045). One implementation, shared by
 * the habit streak maths and every module that buckets rows into user-local days.
 */
export function shiftDayKey(dayKey: string, days: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const nextDay = (dayKey: string): string => shiftDayKey(dayKey, 1);

/** The UTC instant of 00:00 on `dayKey` in `timeZone`. */
export function startOfDayInTimeZone(dayKey: string, timeZone: string): Date {
  const [year, month, day] = dayKey.split("-").map(Number);
  const guess = Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  const zone = resolveTimeZone(timeZone);
  // One correction lands on the offset at that day; a second covers a DST change at midnight.
  const first = guess - offsetMs(new Date(guess), zone);
  return new Date(guess - offsetMs(new Date(first), zone));
}

/** Exclusive upper bound: 00:00 the following day in `timeZone`. */
export function endOfDayInTimeZone(dayKey: string, timeZone: string): Date {
  return startOfDayInTimeZone(nextDay(dayKey), timeZone);
}

// ---------------------------------------------------------------------------
// Week start (spec §6.9, ADR-058)
// ---------------------------------------------------------------------------

export type WeekStart = "mon" | "sun";

export function resolveWeekStart(value: string | null | undefined): WeekStart {
  return value === "sun" ? "sun" : "mon";
}

const shiftKey = shiftDayKey;

/** The `YYYY-MM-DD` of the first day of `instant`'s week in `timeZone`, for the chosen start. */
export function startOfWeekInTimeZone(
  instant: Date,
  timeZone: string,
  weekStart: WeekStart,
): string {
  const day = dayKeyInTimeZone(instant, timeZone);
  const [year, month, date] = day.split("-").map(Number);
  const jsDay = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, date ?? 1)).getUTCDay();
  const offset = weekStart === "mon" ? (jsDay + 6) % 7 : jsDay;
  return shiftKey(day, -offset);
}

/** The UTC instant of the start of `instant`'s week in `timeZone` and week start. */
export function startOfWeekInstant(instant: Date, timeZone: string, weekStart: WeekStart): Date {
  return startOfDayInTimeZone(startOfWeekInTimeZone(instant, timeZone, weekStart), timeZone);
}
