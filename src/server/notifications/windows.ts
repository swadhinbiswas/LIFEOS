/**
 * Notification windows (ADR-047). Pure UTC date helpers, kept out of the service so the dedupe
 * keys a repeated sweep must reproduce are unit-testable without a database.
 *
 * `task` nudges are once a day and `job` nudges once a week; both windows are computed here so
 * the sweep and its tests agree by construction.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** The exclusive upper bound of `date`'s UTC day: a card due before it is due today or overdue. */
export function endOfUtcDay(date: Date): Date {
  return new Date(startOfUtcDay(date).getTime() + DAY_MS);
}

/** Monday (UTC) of `date`'s week as `YYYY-MM-DD` — the follow-up nudge repeats once a week. */
export function weekKey(date: Date): string {
  const day = startOfUtcDay(date);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7)); // Monday
  return day.toISOString().slice(0, 10);
}
