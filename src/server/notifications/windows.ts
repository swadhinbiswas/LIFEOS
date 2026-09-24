/**
 * Notification windows (ADR-047). `weekKey` is UTC-anchored: it only decides how often a weekly
 * nudge may repeat, so a week boundary a few hours off the user's does not matter. Day bucketing
 * for the actual nudges is the user's timezone (ADR-057, `src/lib/timezone.ts`).
 */

/** Monday (UTC) of `date`'s week as `YYYY-MM-DD` — the follow-up nudge repeats once a week. */
export function weekKey(date: Date): string {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7)); // Monday
  return day.toISOString().slice(0, 10);
}
