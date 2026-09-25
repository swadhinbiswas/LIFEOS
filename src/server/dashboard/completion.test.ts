/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import
// that reaches src/env.ts.
process.env.DATABASE_URL = "file:.data/dashboard-completion-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/dashboard-completion-int.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { createBoard, createCard, createColumn, moveCard } = await import("@/server/boards");
const { completedDailySeries } = await import("./completion");

const USER = "01HDONE0000000000000000000001";
const OTHER = "01HDONE0000000000000000000002";

describe("completedDailySeries (ADR-104)", () => {
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

  it("fills the window with zeroes before anything is completed", async () => {
    const now = new Date();
    const series = await completedDailySeries(USER, 3, now, "UTC");
    expect(series.map((row) => row.day)).toEqual([
      new Date(now.getTime() - 2 * 86_400_000).toISOString().slice(0, 10),
      new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10),
      now.toISOString().slice(0, 10),
    ]);
    expect(series.every((row) => row.count === 0 && row.minutes === 0)).toBe(true);
  });

  it("counts a card that reaches a done column, with its estimate", async () => {
    const board = await createBoard(USER, { name: "Ships" });
    const { getBoard } = await import("@/server/boards");
    const payload = await getBoard(USER, board.id);
    const first = payload.columns[0];
    if (!first) throw new Error("the board has no column");
    const done = await createColumn(USER, { boardId: board.id, name: "Shipped", isDone: true });
    const card = await createCard(USER, {
      boardId: board.id,
      columnId: first.id,
      title: "ship it",
      estimateMin: 30,
    });
    await moveCard(USER, {
      cardId: card.id,
      version: card.version,
      toColumnId: done.id,
      prevCardId: null,
      nextCardId: null,
    });

    const series = await completedDailySeries(USER, 1, new Date(), "UTC");
    expect(series[0]?.count).toBe(1);
    expect(series[0]?.minutes).toBe(30);
  });

  it("keeps tenants apart and clamps a silly window", async () => {
    const other = await createBoard(OTHER, { name: "Other" });
    const { getBoard } = await import("@/server/boards");
    const payload = await getBoard(OTHER, other.id);
    const column = payload.columns[0];
    if (!column) throw new Error("the board has no column");

    const series = await completedDailySeries(OTHER, 1, new Date(), "UTC");
    expect(series[0]?.count).toBe(0);
    expect(await completedDailySeries(USER, 0, new Date(), "UTC")).toHaveLength(1);
  });
});
