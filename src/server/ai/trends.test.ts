/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; unique per process.
const DB_FILE = ".data/ai-trends-int-" + process.pid;
process.env.DATABASE_URL = "file:" + DB_FILE + ".db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(DB_FILE + ".db" + suffix, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { createBoard, createCard, createColumn, moveCard } = await import("@/server/boards");
const { createHabit, setHabitLog } = await import("@/server/habits");
const { startSession, stopSession } = await import("@/server/focus");
const { getTrends, trendSummary } = await import("./trends");

const USER = "01HTREND00000000000000000001";
const OTHER = "01HTREND00000000000000000002";
const NOW = new Date();

describe("trends for the copilot (spec 8, ADR-107)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values(
      [USER, OTHER].map((id) => ({
        id,
        email: id.toLowerCase() + "@example.test",
        name: id,
        created_at: new Date(),
        updated_at: new Date(),
      })),
    );
  });

  it("is all zeros for a brand-new account, never a fabricated trend", async () => {
    const trends = await getTrends(OTHER, 14, NOW);
    expect(trends.focusMinutes).toBe(0);
    expect(trends.cardsCompleted).toBe(0);
    expect(trends.habitCount).toBe(0);
    expect(trends.habitConsistencyPercent).toBe(0);
    expect(trends.last7).toHaveLength(7);
    // A zero base has no direction: null, not 0% and not 100%.
    expect(trends.focusChangeVsPrevious7).toBeNull();
    expect(trends.habitChangeVsPrevious7).toBeNull();
  });

  it("counts today's focus block, cards and habits, and keeps tenants apart", async () => {
    const session = await startSession(USER, { plannedMin: 25 });
    await stopSession(USER, session.id);

    const board = await createBoard(USER, { name: "Trend board" });
    const { getBoard } = await import("@/server/boards");
    const payload = await getBoard(USER, board.id);
    const first = payload.columns[0];
    if (!first) throw new Error("the board has no column");
    const done = await createColumn(USER, { boardId: board.id, name: "Shipped", isDone: true });
    const card = await createCard(USER, {
      boardId: board.id,
      columnId: first.id,
      title: "done today",
      estimateMin: 45,
    });
    await moveCard(USER, {
      cardId: card.id,
      version: card.version,
      toColumnId: done.id,
      prevCardId: null,
      nextCardId: null,
    });

    const habit = await createHabit(USER, { name: "walk", cadence: "daily", kind: "binary" });
    await setHabitLog(USER, { habitId: habit.id, value: 1 });

    const trends = await getTrends(USER, 14, NOW);
    expect(trends.habitCount).toBe(1);
    expect(trends.cardsCompleted).toBe(1);
    expect(trends.completedMinutes).toBe(45);
    expect(trends.focusSessions).toBeGreaterThanOrEqual(1);
    expect(trends.last7.at(-1)?.cardsCompleted).toBe(1);
    expect(trends.last7.at(-1)?.habitPercent).toBe(100);

    // The other account still sees nothing.
    expect((await getTrends(OTHER, 14, NOW)).cardsCompleted).toBe(0);
  });

  it("summarises into one line for the system context", async () => {
    const summary = trendSummary(await getTrends(OTHER, 14, NOW));
    expect(summary).toContain("focus");
    expect(summary).toContain("habit consistency");
    expect(summary.split(";").length).toBe(3);
  });
});
