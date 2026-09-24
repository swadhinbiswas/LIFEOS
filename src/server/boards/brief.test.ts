/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import
// that reaches src/env.ts.
process.env.DATABASE_URL = "file:.data/brief-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/brief-int.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { createCard, ensureSystemTasksBoard, getBoard } = await import("@/server/boards");
const { carryOverOverdue, getDailyBrief } = await import("./brief");

const USER = "01HBRIEF00000000000000000001";
const NOW = new Date("2026-09-24T12:00:00.000Z");

async function columnId(name: string): Promise<string> {
  const board = await ensureSystemTasksBoard(USER);
  const payload = await getBoard(USER, board.id);
  const column = payload.columns.find((candidate) => candidate.name === name);
  if (!column) throw new Error(`no column named ${name}`);
  return column.id;
}

describe("daily brief and carry-over (spec 6.2)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values({
      id: USER,
      email: "brief-int@example.test",
      name: "Brief",
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  it("buckets overdue / due-today / inbox and orders the top three by priority", async () => {
    const board = await ensureSystemTasksBoard(USER);
    const inbox = await columnId("Inbox");
    const today = await columnId("Today");

    await createCard(USER, {
      boardId: board.id,
      columnId: inbox,
      title: "old p3",
      dueAt: new Date("2026-09-20T09:00:00.000Z"),
      priority: "p3",
      estimateMin: 30,
    });
    await createCard(USER, {
      boardId: board.id,
      columnId: inbox,
      title: "old p1",
      dueAt: new Date("2026-09-22T09:00:00.000Z"),
      priority: "p1",
      estimateMin: 60,
    });
    await createCard(USER, {
      boardId: board.id,
      columnId: today,
      title: "due today",
      dueAt: new Date("2026-09-24T09:00:00.000Z"),
      estimateMin: 45,
    });
    await createCard(USER, { boardId: board.id, columnId: inbox, title: "someday thing" });

    const brief = await getDailyBrief(USER, NOW);
    expect(brief.overdue.map((card) => card.title).sort()).toEqual(["old p1", "old p3"]);
    expect(brief.dueToday.map((card) => card.title)).toEqual(["due today"]);
    expect(brief.inbox.map((card) => card.title)).toContain("someday thing");
    // top: priority wins, then due date — old p1, then the p3, then the undated card.
    expect(brief.top[0]?.title).toBe("old p1");
    expect(brief.top[1]?.title).toBe("old p3");
    // Today's planned work counts the due-today card and the Today column, not the backlog.
    expect(brief.estimatedMinutesToday).toBe(45);
    expect(brief.openCards).toBe(4);
  });

  it("carries overdue cards into Today in due order, once", async () => {
    const moved = await carryOverOverdue(USER, NOW);
    expect(moved).toBe(2);

    const board = await getBoard(USER, (await ensureSystemTasksBoard(USER)).id);
    const todayColumn = board.columns.find((column) => column.name === "Today");
    const inToday = board.cards
      .filter((card) => card.column_id === todayColumn?.id)
      .sort((a, b) => (a.position < b.position ? -1 : 1))
      .map((card) => card.title);
    expect(inToday).toContain("old p1");
    expect(inToday).toContain("old p3");
    // the oldest debt keeps the earlier position (carry-over orders by due date)
    expect(inToday.indexOf("old p3")).toBeLessThan(inToday.indexOf("old p1"));

    // Nothing overdue remains, so a second press is a no-op.
    expect(await carryOverOverdue(USER, NOW)).toBe(0);
  });
});
