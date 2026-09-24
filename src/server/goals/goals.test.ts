/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import
// that reaches src/env.ts.
process.env.DATABASE_URL = "file:.data/goals-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/goals-int.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { createHabit } = await import("@/server/habits");
const { setHabitLog } = await import("@/server/habits");
const { createGoal, createKeyResult, linkToGoal, listGoals, setKeyResultValue } =
  await import("./index");

const USER = "01HGOALS000000000000000000001";
const OTHER = "01HGOALS000000000000000000002";
const TODAY = "2026-09-24";

describe("goals and key results (spec 6.4)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values(
      [USER, OTHER].map((id) => ({
        id,
        email: `${id.toLowerCase()}@example.test`,
        name: id,
        created_at: new Date(),
        updated_at: new Date(),
      })),
    );
  });

  it("derives objective progress from key results and linked habits", async () => {
    const goal = await createGoal(USER, { title: "Ship Phase 4", period: "2026-Q4" });
    const numeric = await createKeyResult(USER, {
      goalId: goal.id,
      title: "publish 4 case studies",
      kind: "number",
      target: 4,
    });
    await createKeyResult(USER, {
      goalId: goal.id,
      title: "land the habits streak",
      kind: "linked",
      target: 0,
    });

    const habit = await createHabit(USER, { name: "write" });
    await linkToGoal(USER, { goalId: goal.id, entityType: "habit", entityId: habit.id });

    // Nothing done yet: numeric 0/4, linked 0/1 → objective 0%.
    let [view] = await listGoals(USER, new Date(), TODAY);
    expect(view?.progress).toBe(0);
    expect(view?.links).toEqual({ total: 1, done: 0 });

    // Half the numeric target and the habit done today → (50 + 100) / 2 = 75%.
    await setKeyResultValue(USER, { keyResultId: numeric.id, current: 2 });
    await setHabitLog(USER, { habitId: habit.id, date: TODAY, value: 1 });

    [view] = await listGoals(USER, new Date(), TODAY);
    expect(view?.progress).toBe(75);
    expect(view?.links).toEqual({ total: 1, done: 1 });
  });

  it("keeps goals private and flags a stale check-in", async () => {
    const [view] = await listGoals(USER, new Date(Date.now() + 8 * 24 * 60 * 60 * 1000), TODAY);
    expect(view?.needsCheckIn).toBe(true);
    expect(await listGoals(OTHER, new Date(), TODAY)).toEqual([]);
  });
});
