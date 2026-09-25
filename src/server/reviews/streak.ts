import { shiftDayKey, startOfWeekInTimeZone, type WeekStart } from "@/lib/timezone";

/**
 * Weekly review streaks (spec §6.4, ADR-104). Pure over the review rows the service already reads,
 * so the number on the dashboard can be hand-checked in a test.
 *
 * The rule, stated once: a streak is the number of consecutive weeks, ending at this week or the one
 * before it, in which a review was completed. The current week is **grace** — it is not over yet, so
 * a missing review on Monday must not read as a broken streak. Every week after that is required,
 * exactly like the habit rule (ADR-045).
 *
 * Only `period: "weekly"` rows count. A monthly review is a different rhythm and must not be able
 * to masquerade as a weekly one.
 */

export interface ReviewCompletion {
  period: string;
  completed_at: Date | null;
}

export function reviewStreak(
  rows: readonly ReviewCompletion[],
  now: Date,
  timeZone: string,
  weekStart: WeekStart = "mon",
): number {
  const completed = new Set<string>();
  for (const row of rows) {
    if (row.period !== "weekly" || !row.completed_at) continue;
    completed.add(startOfWeekInTimeZone(new Date(row.completed_at), timeZone, weekStart));
  }

  const thisWeek = startOfWeekInTimeZone(now, timeZone, weekStart);
  // Grace: the week in progress is not over, so the walk starts at the last completed week.
  let cursor = completed.has(thisWeek) ? thisWeek : shiftDayKey(thisWeek, -7);

  let streak = 0;
  for (let guard = 0; guard < 520; guard += 1) {
    if (!completed.has(cursor)) break;
    streak += 1;
    cursor = shiftDayKey(cursor, -7);
  }
  return streak;
}
