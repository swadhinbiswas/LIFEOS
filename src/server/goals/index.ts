import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { cards, goal_links, goals, habit_logs, key_results } from "@/server/db/schema";
import { getUserDayKey } from "@/server/settings";

import { goalProgress, keyResultProgress, linkedProgress, type LinkedEntity } from "./progress";

/**
 * Goals / OKRs (spec §6.4). Progress is always derived — key results hold their own numbers, and
 * `linked` key results read the cards and habits they point at via `goal_links`. Nothing stores a
 * percentage, so a goal can never disagree with the work behind it.
 */

export type GoalRow = typeof goals.$inferSelect;
export type KeyResultRow = typeof key_results.$inferSelect;

const CHECK_IN_DAYS = 7;

export interface GoalView {
  goal: GoalRow;
  keyResults: Array<{ row: KeyResultRow; progress: number }>;
  progress: number;
  links: { total: number; done: number };
  /** Active goal whose key results have not moved in a week (spec §6.4 check-in prompt). */
  needsCheckIn: boolean;
}

export async function listGoals(
  userId: string,
  now: Date = new Date(),
  today?: string,
): Promise<GoalView[]> {
  const day = today ?? (await getUserDayKey(userId, now));
  const goalRows = await db
    .select()
    .from(goals)
    .where(eq(goals.user_id, userId))
    .orderBy(desc(goals.created_at));
  if (goalRows.length === 0) return [];

  const ids = goalRows.map((goal) => goal.id);
  const [keyResultRows, linkRows] = await Promise.all([
    db.select().from(key_results).where(inArray(key_results.goal_id, ids)),
    db.select().from(goal_links).where(inArray(goal_links.goal_id, ids)),
  ]);

  const cardIds = linkRows
    .filter((link) => link.entity_type === "card")
    .map((link) => link.entity_id);
  const habitIds = linkRows
    .filter((link) => link.entity_type === "habit")
    .map((link) => link.entity_id);

  const [cardRows, habitRows] = await Promise.all([
    cardIds.length > 0
      ? db
          .select({ id: cards.id, completedAt: cards.completed_at })
          .from(cards)
          .where(
            and(eq(cards.user_id, userId), isNull(cards.deleted_at), inArray(cards.id, cardIds)),
          )
      : Promise.resolve([]),
    habitIds.length > 0
      ? db
          .select({ habitId: habit_logs.habit_id })
          .from(habit_logs)
          .where(
            and(
              eq(habit_logs.user_id, userId),
              eq(habit_logs.date, day),
              inArray(habit_logs.habit_id, habitIds),
            ),
          )
      : Promise.resolve([]),
  ]);

  const cardsById = new Map(cardRows.map((row) => [row.id, row]));
  const habitsDoneToday = new Set(habitRows.map((row) => row.habitId));

  return goalRows.map((goal) => {
    const goalLinks = linkRows.filter((link) => link.goal_id === goal.id);
    const entities: LinkedEntity[] = goalLinks.map((link) =>
      link.entity_type === "card"
        ? { kind: "card", done: Boolean(cardsById.get(link.entity_id)?.completedAt) }
        : { kind: "habit", done: habitsDoneToday.has(link.entity_id) },
    );
    const linked = linkedProgress(entities);

    const resolved = keyResultRows
      .filter((row) => row.goal_id === goal.id)
      .map((row) => ({ row, progress: keyResultProgress(row, linked) }));

    const ageDays = (now.getTime() - new Date(goal.updated_at).getTime()) / (24 * 60 * 60 * 1000);

    return {
      goal,
      keyResults: resolved,
      progress: goalProgress(resolved.map((entry) => entry.progress)),
      links: { total: entities.length, done: entities.filter((entity) => entity.done).length },
      needsCheckIn: goal.status === "active" && ageDays >= CHECK_IN_DAYS,
    };
  });
}

export async function createGoal(
  userId: string,
  input: { title: string; period?: string | null },
): Promise<GoalRow> {
  const [row] = await db
    .insert(goals)
    .values({
      id: newId(),
      user_id: userId,
      title: input.title.trim(),
      period: input.period ?? null,
    })
    .returning();
  if (!row) throw new Error("goal insert returned no row");
  return row;
}

export async function updateGoal(
  userId: string,
  input: { goalId: string; title?: string; status?: string },
): Promise<GoalRow> {
  const patch: Partial<typeof goals.$inferInsert> = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.status !== undefined) patch.status = input.status;

  const [row] = await db
    .update(goals)
    .set(patch)
    .where(and(eq(goals.id, input.goalId), eq(goals.user_id, userId)))
    .returning();
  if (!row) throw new Error("goal not found");
  return row;
}

export async function createKeyResult(
  userId: string,
  input: { goalId: string; title: string; kind: "number" | "percent" | "linked"; target: number },
): Promise<KeyResultRow> {
  const [goal] = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.id, input.goalId), eq(goals.user_id, userId)))
    .limit(1);
  if (!goal) throw new Error("goal not found");

  const [row] = await db
    .insert(key_results)
    .values({
      id: newId(),
      user_id: userId,
      goal_id: input.goalId,
      title: input.title.trim(),
      kind: input.kind,
      target: input.target,
    })
    .returning();
  if (!row) throw new Error("key result insert returned no row");
  return row;
}

export async function setKeyResultValue(
  userId: string,
  input: { keyResultId: string; current: number },
): Promise<KeyResultRow> {
  const [row] = await db
    .update(key_results)
    .set({ current: input.current })
    .where(and(eq(key_results.id, input.keyResultId), eq(key_results.user_id, userId)))
    .returning();
  if (!row) throw new Error("key result not found");
  return row;
}

/** Link a card or habit to a goal; unknown ids simply are not linked. */
export async function linkToGoal(
  userId: string,
  input: { goalId: string; entityType: "card" | "habit"; entityId: string },
): Promise<void> {
  const [goal] = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.id, input.goalId), eq(goals.user_id, userId)))
    .limit(1);
  if (!goal) throw new Error("goal not found");

  await db
    .insert(goal_links)
    .values({
      id: newId(),
      user_id: userId,
      goal_id: input.goalId,
      entity_type: input.entityType,
      entity_id: input.entityId,
    })
    .onConflictDoNothing();
}

export interface GoalOption {
  id: string;
  title: string;
}

/** A picker needs names, not progress: the full goal view is far too heavy for a card sheet. */
export async function listGoalOptions(userId: string): Promise<GoalOption[]> {
  return db
    .select({ id: goals.id, title: goals.title })
    .from(goals)
    .where(and(eq(goals.user_id, userId), ne(goals.status, "dropped")))
    .orderBy(goals.title);
}

/** The goals one card is linked to — what the card sheet shows alongside the link control. */
export async function listCardLinks(userId: string, cardId: string): Promise<GoalOption[]> {
  return db
    .select({ id: goals.id, title: goals.title })
    .from(goal_links)
    .innerJoin(goals, eq(goals.id, goal_links.goal_id))
    .where(
      and(
        eq(goal_links.user_id, userId),
        eq(goal_links.entity_type, "card"),
        eq(goal_links.entity_id, cardId),
      ),
    )
    .orderBy(goals.title);
}

/** Remove one link; the goal and the card are both untouched. */
export async function unlinkFromGoal(
  userId: string,
  input: { goalId: string; entityType: "card" | "habit"; entityId: string },
): Promise<void> {
  await db
    .delete(goal_links)
    .where(
      and(
        eq(goal_links.user_id, userId),
        eq(goal_links.goal_id, input.goalId),
        eq(goal_links.entity_type, input.entityType),
        eq(goal_links.entity_id, input.entityId),
      ),
    );
}
