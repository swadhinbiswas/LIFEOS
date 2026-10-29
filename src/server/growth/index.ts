import { and, desc, eq, inArray } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import {
  goals,
  growth_plan_links,
  growth_plans,
  growth_reviews,
  habit_logs,
  habits,
  key_results,
} from "@/server/db/schema";

import { DIMENSIONS, type DimensionId, isDimension } from "./dimensions";

export type GrowthPlan = {
  id: string;
  userId: string;
  dimensionId: DimensionId;
  title: string;
  why: string | null;
  targetDate: string | null;
  status: "active" | "achieved" | "archived";
  goalIds: string[];
  habitIds: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type DimensionProgress = {
  dimensionId: DimensionId;
  goalPct: number | null; // null = unmeasured
  habitPct: number | null;
  habitAvailable: boolean;
  goals: number;
  habits: number;
  completed: number; // completed goals count
  eligible: number; // eligible habit-days
};

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export async function createPlan(
  userId: string,
  input: { dimensionId: string; title: string; why?: string | null; targetDate?: string | null },
): Promise<string> {
  if (!isDimension(input.dimensionId)) throw new Error("unknown dimension");
  const id = newId();
  await db.insert(growth_plans).values({
    id,
    user_id: userId,
    dimension_id: input.dimensionId,
    title: input.title.trim(),
    why: input.why?.trim() || null,
    target_date: input.targetDate || null,
  });
  return id;
}

export async function listPlans(userId: string): Promise<GrowthPlan[]> {
  const rows = await db
    .select()
    .from(growth_plans)
    .where(eq(growth_plans.user_id, userId))
    .orderBy(growth_plans.created_at);
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const links = await db
    .select()
    .from(growth_plan_links)
    .where(inArray(growth_plan_links.plan_id, ids));
  const byPlan = new Map<string, { goals: string[]; habits: string[] }>();
  for (const link of links) {
    const bucket = byPlan.get(link.plan_id) ?? { goals: [], habits: [] };
    if (link.entity_type === "goal") bucket.goals.push(link.entity_id);
    else if (link.entity_type === "habit") bucket.habits.push(link.entity_id);
    byPlan.set(link.plan_id, bucket);
  }
  return rows.map((r) => {
    const b = byPlan.get(r.id) ?? { goals: [], habits: [] };
    return {
      id: r.id,
      userId: r.user_id,
      dimensionId: r.dimension_id as DimensionId,
      title: r.title,
      why: r.why,
      targetDate: r.target_date,
      status: r.status as "active" | "achieved" | "archived",
      goalIds: b.goals,
      habitIds: b.habits,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
}

export async function updatePlan(
  userId: string,
  planId: string,
  input: {
    title?: string;
    why?: string | null;
    targetDate?: string | null;
    status?: "active" | "achieved" | "archived";
  },
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date() };
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.why !== undefined) patch.why = input.why?.trim() || null;
  if (input.targetDate !== undefined) patch.target_date = input.targetDate || null;
  if (input.status !== undefined) patch.status = input.status;
  await db
    .update(growth_plans)
    .set(patch)
    .where(and(eq(growth_plans.id, planId), eq(growth_plans.user_id, userId)));
}

export async function deletePlan(userId: string, planId: string): Promise<void> {
  await db
    .delete(growth_plans)
    .where(and(eq(growth_plans.id, planId), eq(growth_plans.user_id, userId)));
}

export async function linkToPlan(
  userId: string,
  planId: string,
  entityType: "goal" | "habit",
  entityId: string,
): Promise<void> {
  const [plan] = await db
    .select({ id: growth_plans.id })
    .from(growth_plans)
    .where(and(eq(growth_plans.id, planId), eq(growth_plans.user_id, userId)))
    .limit(1);
  if (!plan) throw new Error("plan not found");
  await db
    .insert(growth_plan_links)
    .values({
      id: newId(),
      plan_id: planId,
      user_id: userId,
      entity_type: entityType,
      entity_id: entityId,
    })
    .onConflictDoNothing();
}

export async function unlinkFromPlan(
  userId: string,
  planId: string,
  entityType: "goal" | "habit",
  entityId: string,
): Promise<void> {
  await db
    .delete(growth_plan_links)
    .where(
      and(
        eq(growth_plan_links.plan_id, planId),
        eq(growth_plan_links.user_id, userId),
        eq(growth_plan_links.entity_type, entityType),
        eq(growth_plan_links.entity_id, entityId),
      ),
    );
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

/**
 * Compute progress for a single dimension. Pure-ish (reads DB). Returns null goalPct when no
 * measured goals exist, and null habitPct when no habits are linked.
 */
export async function dimensionProgress(
  userId: string,
  dimensionId: DimensionId,
  _today: string,
): Promise<DimensionProgress> {
  const plans = (await listPlans(userId)).filter(
    (p) => p.dimensionId === dimensionId && p.status !== "archived",
  );
  const goalIds = [...new Set(plans.flatMap((p) => p.goalIds))];
  const habitIds = [...new Set(plans.flatMap((p) => p.habitIds))];

  // SMART progress: average of linked non-archived goals with usable measurements.
  let goalPct: number | null = null;
  let completedGoals = 0;
  if (goalIds.length > 0) {
    const goalRows = await db
      .select()
      .from(goals)
      .where(and(eq(goals.user_id, userId), inArray(goals.id, goalIds)));
    const krRows = goalRows.length
      ? await db.select().from(key_results).where(inArray(key_results.goal_id, goalIds))
      : [];
    const progresses: number[] = [];
    for (const g of goalRows) {
      const krs = krRows.filter((k) => k.goal_id === g.id);
      if (krs.length === 0) continue;
      // Each KR: if kind=number/percent, use current/target; if linked, 0 (no card/habit here).
      const krProgresses = krs.map((kr) => {
        if (kr.kind === "percent") return Math.max(0, Math.min(100, kr.current));
        if (kr.kind === "number") {
          if (kr.target <= 0) return kr.current > 0 ? 100 : 0;
          return Math.max(0, Math.min(100, Math.round((kr.current / kr.target) * 100)));
        }
        return 0;
      });
      const avg = krProgresses.reduce((a, b) => a + b, 0) / krProgresses.length;
      progresses.push(avg);
      if (avg >= 100) completedGoals++;
    }
    if (progresses.length > 0) {
      goalPct = Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length);
    }
  }

  // Habit consistency: completions / eligible daily opportunities over last 7 days.
  let habitPct: number | null = null;
  let habitAvailable = true;
  let eligibleDays = 0;
  let completedDays = 0;
  if (habitIds.length > 0) {
    try {
      const logs = await db
        .select()
        .from(habit_logs)
        .where(and(eq(habit_logs.user_id, userId), inArray(habit_logs.habit_id, habitIds)));
      // Last 7 Tehran dates including today
      const dates: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const dt = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        dates.push(dt.toISOString().slice(0, 10));
      }
      // For each habit, count completed days within its existence window
      const habitRows = await db.select().from(habits).where(inArray(habits.id, habitIds));
      const createdAtByHabit = new Map(habitRows.map((h) => [h.id, h.created_at]));
      for (const habitId of habitIds) {
        const created = createdAtByHabit.get(habitId);
        const createdDay = created ? new Date(created).toISOString().slice(0, 10) : null;
        for (const day of dates) {
          if (createdDay && day < createdDay) continue; // days before creation excluded
          eligibleDays++;
          const log = logs.find((l) => l.habit_id === habitId && l.date === day);
          if (log && log.value > 0) completedDays++;
        }
      }
      if (eligibleDays > 0) {
        habitPct = Math.round((completedDays / eligibleDays) * 100);
      }
    } catch {
      habitAvailable = false;
    }
  }

  return {
    dimensionId,
    goalPct,
    habitPct,
    habitAvailable,
    goals: goalIds.length,
    habits: habitIds.length,
    completed: completedGoals,
    eligible: eligibleDays,
  };
}

export async function allDimensionProgress(
  userId: string,
  today: string,
): Promise<DimensionProgress[]> {
  const results: DimensionProgress[] = [];
  for (const d of DIMENSIONS) {
    results.push(await dimensionProgress(userId, d.id, today));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export async function createReview(
  userId: string,
  input: {
    cadence: "weekly" | "monthly" | "quarterly";
    reviewDate: string;
    notes: Record<string, { reflection: string; next: string }>;
    snapshot: Record<string, DimensionProgress>;
  },
): Promise<string> {
  const id = newId();
  await db.insert(growth_reviews).values({
    id,
    user_id: userId,
    cadence: input.cadence,
    review_date: input.reviewDate,
    notes_json: JSON.stringify(input.notes),
    snapshot_json: JSON.stringify(input.snapshot),
  });
  return id;
}

export async function listReviews(
  userId: string,
  cadence?: string,
): Promise<
  Array<{
    id: string;
    cadence: string;
    reviewDate: string;
    createdAt: Date;
    notes: Record<string, { reflection: string; next: string }>;
    snapshot: Record<string, DimensionProgress>;
  }>
> {
  const rows = cadence
    ? await db
        .select()
        .from(growth_reviews)
        .where(and(eq(growth_reviews.user_id, userId), eq(growth_reviews.cadence, cadence)))
        .orderBy(desc(growth_reviews.review_date))
    : await db
        .select()
        .from(growth_reviews)
        .where(eq(growth_reviews.user_id, userId))
        .orderBy(desc(growth_reviews.review_date));
  return rows.map((r) => ({
    id: r.id,
    cadence: r.cadence,
    reviewDate: r.review_date,
    createdAt: r.created_at,
    notes: JSON.parse(r.notes_json) as Record<string, { reflection: string; next: string }>,
    snapshot: JSON.parse(r.snapshot_json) as Record<string, DimensionProgress>,
  }));
}

/** Due date for a cadence: rolling interval from latest review of same cadence, or today if none. */
export async function reviewDueDate(
  userId: string,
  cadence: "weekly" | "monthly" | "quarterly",
): Promise<string> {
  const reviews = await listReviews(userId, cadence);
  if (reviews.length === 0) return new Date().toISOString().slice(0, 10);
  const latest = reviews[0]!.reviewDate;
  const days = cadence === "weekly" ? 7 : cadence === "monthly" ? 30 : 90;
  const d = new Date(latest + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
