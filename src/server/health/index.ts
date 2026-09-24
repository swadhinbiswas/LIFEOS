import { and, desc, eq, gte } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { health_logs } from "@/server/db/schema";
import { getUserDayKey } from "@/server/settings";

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
  const date = input.date ?? (await getUserDayKey(userId));
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
  const today = options.today ?? (await getUserDayKey(userId));
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

export async function healthSummary(userId: string, today?: string): Promise<HealthSummary> {
  const day = today ?? (await getUserDayKey(userId));
  const rows = await listHealth(userId, { days: 28, today: day });
  return {
    trends: kindTrends(
      rows.map((row) => ({ kind: row.kind, value: row.value, unit: row.unit, date: row.date })),
      day,
      28,
    ),
    today: rows
      .filter((row) => row.date === day)
      .map((row) => ({ kind: row.kind, value: row.value, unit: row.unit })),
  };
}
