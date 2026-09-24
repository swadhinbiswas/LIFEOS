/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import
// that reaches src/env.ts.
process.env.DATABASE_URL = "file:.data/habits-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/habits-int.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { createHabit, listHabits, setHabitLog } = await import("./index");
const { shiftDay } = await import("./streak");

const USER = "01HHABITS00000000000000000001";
const OTHER = "01HHABITS00000000000000000002";
const TODAY = "2026-09-24";

describe("habit service (spec 6.4, adr-045)", () => {
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

  it("logs a day, derives the streak and the target progress", async () => {
    const habit = await createHabit(USER, {
      name: "drink water",
      kind: "numeric",
      target: 8,
      unit: "glasses",
    });

    await setHabitLog(USER, { habitId: habit.id, date: TODAY, value: 4 });
    let [view] = await listHabits(USER, TODAY);
    expect(view?.value).toBe(4);
    expect(view?.progress).toBe(50);
    expect(view?.streak).toBe(1);
    expect(view?.days.at(-1)).toEqual({ key: TODAY, done: true, value: 4 });

    // Yesterday as well: two consecutive days is a two-day streak.
    await setHabitLog(USER, { habitId: habit.id, date: shiftDay(TODAY, -1), value: 8 });
    [view] = await listHabits(USER, TODAY);
    expect(view?.streak).toBe(2);

    // Logging zero clears the day rather than storing a zero.
    await setHabitLog(USER, { habitId: habit.id, date: TODAY, value: 0 });
    [view] = await listHabits(USER, TODAY);
    expect(view?.value).toBe(0);
    expect(view?.days.at(-1)?.done).toBe(false);
    expect(view?.streak).toBe(1); // today is open, so the streak runs to yesterday
  });

  it("keeps habits private to their owner", async () => {
    expect(await listHabits(OTHER, TODAY)).toEqual([]);
    await expect(
      setHabitLog(OTHER, { habitId: "01HNOPE00000000000000000000", date: TODAY, value: 1 }),
    ).rejects.toThrow();
  });
});
