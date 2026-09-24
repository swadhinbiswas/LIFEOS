/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import
// that reaches src/env.ts.
process.env.DATABASE_URL = "file:.data/search-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/search-int.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { createBoard, createCard, ensureSystemTasksBoard, getBoard } =
  await import("@/server/boards");
const { search } = await import("./index");

const USER = "01HSEARCH000000000000000001";
const OTHER_USER = "01HSEARCH000000000000000002";

async function firstColumnId(boardId: string): Promise<string> {
  const [column] = (await getBoard(USER, boardId)).columns;
  if (!column) throw new Error("board has no columns");
  return column.id;
}

describe("command-palette search (spec 4.3)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values(
      [USER, OTHER_USER].map((id) => ({
        id,
        email: `${id.toLowerCase()}@example.test`,
        name: id,
        created_at: new Date(),
        updated_at: new Date(),
      })),
    );
  });

  it("finds cards across boards, with the board name and routing hint", async () => {
    const tasks = await ensureSystemTasksBoard(USER);
    await createCard(USER, {
      boardId: tasks.id,
      columnId: await firstColumnId(tasks.id),
      title: "Quarterly Report",
    });

    const board = await createBoard(USER, { name: "Reading List", template: "reading-list" });
    await createCard(USER, {
      boardId: board.id,
      columnId: await firstColumnId(board.id),
      title: "quarterly review notes",
    });

    const hits = await search(USER, "quarter");
    expect(hits.cards).toHaveLength(2);
    expect(hits.cards.some((hit) => hit.isSystem && hit.boardName === "Tasks")).toBe(true);
    expect(hits.cards.some((hit) => !hit.isSystem && hit.boardName === "Reading List")).toBe(true);

    expect((await search(USER, "reading")).boards.map((hit) => hit.name)).toContain("Reading List");
  });

  it("escapes LIKE wildcards instead of treating them as patterns", async () => {
    const tasks = await ensureSystemTasksBoard(USER);
    await createCard(USER, {
      boardId: tasks.id,
      columnId: await firstColumnId(tasks.id),
      title: "100% done",
    });

    expect((await search(USER, "100%")).cards.map((hit) => hit.title)).toContain("100% done");

    // A bare `%` is a literal, not "match everything".
    const wildcard = await search(USER, "%");
    expect(wildcard.cards.length).toBeGreaterThan(0);
    expect(wildcard.cards.every((hit) => hit.title.includes("%"))).toBe(true);
  });

  it("never returns another user's rows", async () => {
    const hits = await search(OTHER_USER, "quarter");
    expect(hits.cards).toEqual([]);
    expect(hits.boards).toEqual([]);
  });

  it("returns nothing for a blank query", async () => {
    expect(await search(USER, "   ")).toEqual({ cards: [], boards: [] });
  });
});
