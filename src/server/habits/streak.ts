/**
 * Habit streaks (spec §6.4). Pure functions over day keys so the rules are testable without a
 * database and the same code backs both the service and the UI copy.
 *
 * Day keys are the user's calendar day (`YYYY-MM-DD`, ADR-045) and all arithmetic happens in
 * UTC on the key itself, so a streak never shifts because of a timezone or a DST boundary.
 */

import { shiftDayKey } from "@/lib/timezone";

export const dayKey = (date: Date): string => date.toISOString().slice(0, 10);

/** One shared day-key implementation (lib/timezone), so habits and other modules bucket alike. */
export function shiftDay(key: string, days: number): string {
  return shiftDayKey(key, days);
}

/** Inclusive list of day keys from `from` to `to`. */
export function dayRange(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = from;
  for (let guard = 0; guard < 3660; guard += 1) {
    days.push(cursor);
    if (cursor >= to) break;
    cursor = shiftDay(cursor, 1);
  }
  return days;
}

export interface StreakOptions {
  /** Consecutive misses tolerated before the streak breaks (spec: "never miss twice"). */
  graceDays?: number;
  /** Explicit freeze days the habit allows (consumed before grace). */
  freezeDays?: number;
}

/**
 * The current streak as of `today`.
 *
 * Rules, in the order they apply to a missed day: spend a **freeze day** if the habit has one,
 * otherwise spend the **grace** miss — a second consecutive miss with nothing left ends the
 * streak. A day that has not been done *yet* (today) does not break a streak, so the count is
 * taken from the most recent completion when today is empty.
 */
export function computeStreak(
  done: ReadonlySet<string>,
  today: string,
  options: StreakOptions = {},
): number {
  const graceDays = options.graceDays ?? 1;
  const freezeDays = options.freezeDays ?? 0;

  let cursor = today;
  if (!done.has(cursor)) {
    let probe = today;
    let found = false;
    for (let guard = 0; guard < 3660; guard += 1) {
      probe = shiftDay(probe, -1);
      if (done.has(probe)) {
        cursor = probe;
        found = true;
        break;
      }
    }
    if (!found) return 0;
  }

  let streak = 0;
  let grace = graceDays;
  let freezes = freezeDays;

  for (let guard = 0; guard < 3660; guard += 1) {
    if (done.has(cursor)) {
      streak += 1;
      // Each completion restores the allowances.
      grace = graceDays;
      freezes = freezeDays;
    } else if (freezes > 0) {
      freezes -= 1;
    } else if (grace > 0) {
      grace -= 1;
    } else {
      break;
    }
    cursor = shiftDay(cursor, -1);
  }

  return streak;
}

export interface HabitDay {
  key: string;
  done: boolean;
  value: number;
}

/** The last `days` days ending today, newest last — what the habit row and heatmap render. */
export function recentDays(
  logs: ReadonlyMap<string, number>,
  today: string,
  days = 28,
): HabitDay[] {
  return dayRange(shiftDay(today, -(days - 1)), today).map((key) => ({
    key,
    done: logs.has(key),
    value: logs.get(key) ?? 0,
  }));
}

/** How much of a numeric target today's log reaches, for meters (never negative, capped at 100). */
export function targetProgress(value: number, target: number | null): number {
  if (!target || target <= 0) return value > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
}
