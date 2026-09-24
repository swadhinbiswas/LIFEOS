import { and, desc, eq, gte } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { health_logs } from "@/server/db/schema";
import { dayKey } from "@/server/habits/streak";

import { kindTrends, windowDays, type KindTrend } from "./trends";

/**
 * Health-lite (spec §6.6): simple logs for sleep, workouts, water, mood and weight, plus weekly
 * trends. Values keep the unit the user typed — the module never converts glasses into litres or
 * kilograms into pounds, and makes no medical claim.
 */

export type HealthLogRow = typeof health_logs.$inferSelect;

export const HEALTH_KINDS = ["sleep", "workout", "water", "mood", "weight"] as const;
export type HealthKind = (typeof HEALTH_KINDS)[number];

/** One entry per kind per day: logging again replaces that day rather than stacking. */
export async function logHealth(
  userId: string,
  input: {
    kind: HealthKind;
    value: number;
    unit?: string | null;
    date?: string;
    note?: string | null;
  },
): Promise<HealthLogRow> {
  const date = input.date ?? dayKey(new Date());
  await db
    .delete(health_logs)
    .where(
      and(
        eq(health_logs.user_id, userId),
        eq(health_logs.kind, input.kind),
        eq(health_logs.date, date),
      ),
    );

  const [row] = await db
    .insert(health_logs)
    .values({
      id: newId(),
      user_id: userId,
      kind: input.kind,
      value: input.value,
      unit: input.unit ?? null,
      date,
      note: input.note ?? null,
    })
    .returning();
  if (!row) throw new Error("health log insert returned no row");
  return row;
}

export async function listHealth(
  userId: string,
  options: { days?: number; today?: string } = {},
): Promise<HealthLogRow[]> {
  const today = options.today ?? dayKey(new Date());
  const [from] = windowDays(today, options.days ?? 28);
  if (!from) return [];
  return db
    .select()
    .from(health_logs)
    .where(and(eq(health_logs.user_id, userId), gte(health_logs.date, from)))
    .orderBy(desc(health_logs.date), health_logs.kind);
}

export interface HealthSummary {
  trends: KindTrend[];
  today: Array<{ kind: string; value: number; unit: string | null }>;
}

export async function healthSummary(
  userId: string,
  today: string = dayKey(new Date()),
): Promise<HealthSummary> {
  const rows = await listHealth(userId, { days: 28, today });
  return {
    trends: kindTrends(
      rows.map((row) => ({ kind: row.kind, value: row.value, unit: row.unit, date: row.date })),
      today,
      28,
    ),
    today: rows
      .filter((row) => row.date === today)
      .map((row) => ({ kind: row.kind, value: row.value, unit: row.unit })),
  };
}
