import { and, eq, gte } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { habit_logs, habits } from "@/server/db/schema";
import { getUserDayKey } from "@/server/settings";

import { computeStreak, recentDays, shiftDay, targetProgress, type HabitDay } from "./streak";

/**
 * Habit service (spec §6.4). The log is the source of truth; streaks, heatmaps and progress are
 * derived (ADR-045), which is why a habit's rules ("never miss twice", freeze days) can change
 * without touching stored rows.
 */

export type HabitRow = typeof habits.$inferSelect;

export interface HabitView {
  habit: HabitRow;
  today: string;
  /** Today's logged value (0 when not logged). */
  value: number;
  streak: number;
  /** Last 28 days, newest last. */
  days: HabitDay[];
  /** Progress against a numeric target, or null for binary habits. */
  progress: number | null;
}

const HISTORY_DAYS = 400; // plenty for a current streak even with freeze days

export async function listHabits(userId: string, today?: string): Promise<HabitView[]> {
  const day = today ?? (await getUserDayKey(userId));
  const rows = await db
    .select()
    .from(habits)
    .where(eq(habits.user_id, userId))
    .orderBy(habits.name);

  if (rows.length === 0) return [];

  const logs = await db
    .select()
    .from(habit_logs)
    .where(and(eq(habit_logs.user_id, userId), gte(habit_logs.date, shiftDay(day, -HISTORY_DAYS))));

  const byHabit = new Map<string, Map<string, number>>();
  for (const log of logs) {
    const bucket = byHabit.get(log.habit_id) ?? new Map<string, number>();
    bucket.set(log.date, log.value);
    byHabit.set(log.habit_id, bucket);
  }

  return rows.map((habit) => {
    const entries = byHabit.get(habit.id) ?? new Map<string, number>();
    const value = entries.get(day) ?? 0;
    return {
      habit,
      today: day,
      value,
      streak: computeStreak(new Set(entries.keys()), day, {
        graceDays: 1,
        freezeDays: habit.freeze_days,
      }),
      days: recentDays(entries, day, 28),
      progress: habit.kind === "numeric" ? targetProgress(value, habit.target) : null,
    };
  });
}

export async function createHabit(
  userId: string,
  input: {
    name: string;
    cadence?: string;
    kind?: string;
    target?: number | null;
    unit?: string | null;
    glyph?: string | null;
    color?: string | null;
    freezeDays?: number;
  },
): Promise<HabitRow> {
  const [row] = await db
    .insert(habits)
    .values({
      id: newId(),
      user_id: userId,
      name: input.name.trim(),
      cadence: input.cadence ?? "daily",
      kind: input.kind ?? "binary",
      target: input.target ?? null,
      unit: input.unit ?? null,
      glyph: input.glyph ?? null,
      color: input.color ?? null,
      freeze_days: input.freezeDays ?? 0,
    })
    .returning();
  if (!row) throw new Error("habit insert returned no row");
  return row;
}

/** Upsert a day's value; a value of zero or less clears the day instead of storing a zero. */
export async function setHabitLog(
  userId: string,
  input: { habitId: string; date?: string; value: number; note?: string | null },
): Promise<void> {
  const [habit] = await db
    .select({ id: habits.id })
    .from(habits)
    .where(and(eq(habits.id, input.habitId), eq(habits.user_id, userId)))
    .limit(1);
  if (!habit) throw new Error("habit not found");

  const date = input.date ?? (await getUserDayKey(userId));
  if (input.value <= 0) {
    await db
      .delete(habit_logs)
      .where(
        and(
          eq(habit_logs.user_id, userId),
          eq(habit_logs.habit_id, input.habitId),
          eq(habit_logs.date, date),
        ),
      );
    return;
  }

  await db
    .insert(habit_logs)
    .values({
      id: newId(),
      user_id: userId,
      habit_id: input.habitId,
      date,
      value: input.value,
      note: input.note ?? null,
    })
    .onConflictDoUpdate({
      target: [habit_logs.habit_id, habit_logs.date],
      set: { value: input.value, note: input.note ?? null, updated_at: new Date() },
    });
}

export async function deleteHabit(userId: string, habitId: string): Promise<void> {
  await db.delete(habits).where(and(eq(habits.id, habitId), eq(habits.user_id, userId)));
}
