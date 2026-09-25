import type { ConstellationRow } from "@/app/(app)/dashboard/_components/habit-constellation";
import type { HabitDay } from "@/server/habits/streak";

/**
 * Habit-derived dashboard series (spec §6.8, ADR-101). Pure functions over the same
 * `HabitDay` rows the streaks use, so every number on the dashboard can be hand-checked in a test
 * and no chart has to compute anything itself.
 */

export interface HabitDayShare {
  /** `YYYY-MM-DD`. */
  day: string;
  /** Percent of habits checked off that day, 0…100. */
  value: number;
}

/** The shape both helpers need — `HabitView` satisfies it structurally. */
interface HabitDaySource {
  days: readonly HabitDay[];
}

export interface StreakSource extends HabitDaySource {
  id: string;
  name: string;
  streak: number;
}

/**
 * Percent of habits completed per day for the last `days` days, oldest first.
 *
 * Every habit is aligned by **day key**, not by array index, so a habit whose history is a
 * different length cannot silently skew a bar (spec §1: no invented data). With no habits the
 * result is empty, which the chart renders as an empty state rather than a row of zeroes.
 */
export function habitConsistencySeries(
  habits: readonly HabitDaySource[],
  days = 14,
): HabitDayShare[] {
  if (habits.length === 0) return [];
  const window = Math.max(1, Math.round(days));

  return habits[0]!.days.slice(-window).map((day) => {
    const done = habits.filter((habit) =>
      habit.days.some((row) => row.key === day.key && row.done),
    ).length;
    return { day: day.key, value: Math.round((done / habits.length) * 100) };
  });
}

/**
 * One constellation row per habit: the last `weekDays` days for the dot strip and sparkline, and
 * the share of the whole 28-day window for the ASCII meter.
 */
export function constellationRows(
  habits: ReadonlyArray<StreakSource>,
  weekDays = 7,
): ConstellationRow[] {
  const week = Math.max(1, Math.round(weekDays));
  return habits.map((habit) => {
    const days = habit.days;
    const tail = days.slice(-week);
    const done = days.filter((day) => day.done).length;
    return {
      id: habit.id,
      name: habit.name,
      streak: habit.streak,
      week: tail.map((day) => ({ key: day.key, done: day.done })),
      values: tail.map((day) => day.value),
      ratio: days.length > 0 ? done / days.length : 0,
    };
  });
}
