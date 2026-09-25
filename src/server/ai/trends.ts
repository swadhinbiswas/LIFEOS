import { dayKeyInTimeZone } from "@/lib/timezone";
import { completedDailySeries } from "@/server/dashboard/completion";
import { habitConsistencySeries } from "@/server/dashboard/habits";
import { focusDailySeries } from "@/server/focus";
import { listHabits } from "@/server/habits";
import { getTimeZone } from "@/server/settings";

/**
 * Trends across the modules the dashboard already charts (ADR-107).
 *
 * Every AI tool in this repo is a thin adapter over a service the UI already uses, and until now
 * not one of them returned a time series - "how am I trending?" was the one question the copilot
 * could not answer without guessing. This composes the three series the dashboard renders (focus
 * minutes, habit consistency, completed cards) into the shape a question actually needs: totals
 * for the window, the last seven days, and the change against the seven before them.
 *
 * Aggregates, never raw rows: the model gets numbers it can compare, at a fraction of the tokens
 * a 14-day dump would cost. A window with no activity reports zeros and `changeVsPrevious7: null`,
 * so "no data" is never dressed up as a trend (spec §1).
 */

export interface TrendWindow {
  /** Whole days in the window. */
  days: number;
  focusMinutes: number;
  /** Days in the window with at least one completed focus session. */
  focusActiveDays: number;
  focusSessions: number;
  /** Percent of habits checked off per day, averaged over the window. */
  habitConsistencyPercent: number;
  habitCount: number;
  cardsCompleted: number;
  /** Estimated minutes of the completed cards — effort next to output. */
  completedMinutes: number;
  /** The last seven days, oldest first, so a shape can be read directly. */
  last7: {
    day: string;
    focusMinutes: number;
    habitPercent: number;
    cardsCompleted: number;
  }[];
  /**
   * Percent change in focus minutes, last 7 days against the 7 before, or null when there is no
   * earlier window to compare against.
   */
  focusChangeVsPrevious7: number | null;
  habitChangeVsPrevious7: number | null;
}

const clampDays = (days: number): number => Math.min(90, Math.max(7, Math.round(days)));

export async function getTrends(
  userId: string,
  days = 14,
  now: Date = new Date(),
): Promise<TrendWindow> {
  const window = clampDays(days);
  const timeZone = await getTimeZone(userId);

  const [focus, completed, habits] = await Promise.all([
    focusDailySeries(userId, window, now, timeZone),
    completedDailySeries(userId, window, now, timeZone),
    listHabits(userId, dayKeyInTimeZone(now, timeZone)),
  ]);
  const consistency = habitConsistencySeries(habits, window);
  const byDay = new Map(consistency.map((row) => [row.day, row.value]));

  const focusMinutes = focus.reduce((sum, row) => sum + row.minutes, 0);
  const focusActiveDays = focus.filter((row) => row.sessions > 0).length;
  const focusSessions = focus.reduce((sum, row) => sum + row.sessions, 0);
  const habitConsistencyPercent = consistency.length
    ? Math.round(consistency.reduce((sum, row) => sum + row.value, 0) / consistency.length)
    : 0;

  const tail = focus.slice(-7);
  const head = focus.slice(0, -7);
  const last7Focus = tail.reduce((sum, row) => sum + row.minutes, 0);
  const previous7Focus = head.reduce((sum, row) => sum + row.minutes, 0);
  const last7Habits = tail.reduce((sum, row) => sum + (byDay.get(row.day) ?? 0), 0);
  const previous7Habits = head.reduce((sum, row) => sum + (byDay.get(row.day) ?? 0), 0);

  return {
    days: window,
    focusMinutes,
    focusActiveDays,
    focusSessions,
    habitConsistencyPercent,
    habitCount: habits.length,
    cardsCompleted: completed.reduce((sum, row) => sum + row.count, 0),
    completedMinutes: completed.reduce((sum, row) => sum + row.minutes, 0),
    last7: tail.map((row) => ({
      day: row.day,
      focusMinutes: row.minutes,
      habitPercent: byDay.get(row.day) ?? 0,
      cardsCompleted: completed.find((entry) => entry.day === row.day)?.count ?? 0,
    })),
    focusChangeVsPrevious7: change(last7Focus, previous7Focus),
    habitChangeVsPrevious7: change(last7Habits, previous7Habits),
  };
}

/** Percent change, or null when the earlier window is empty (a zero base is not a trend). */
const change = (current: number, previous: number): number | null =>
  previous === 0 ? null : Math.round(((current - previous) / previous) * 100);

/** A one-line trend summary for the copilot's system context (compact by design, ADR-077). */
export function trendSummary(trends: TrendWindow): string {
  const focus =
    trends.focusChangeVsPrevious7 === null
      ? trends.focusMinutes + " min"
      : trends.focusMinutes +
        " min (" +
        (trends.focusChangeVsPrevious7 > 0 ? "+" : "") +
        trends.focusChangeVsPrevious7 +
        "% vs prior 7d)";
  return [
    "focus " + focus,
    "habit consistency " + trends.habitConsistencyPercent + "% over " + trends.days + "d",
    "cards completed " + trends.cardsCompleted,
  ].join("; ");
}
