/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import
// that reaches src/env.ts.
process.env.DATABASE_URL = "file:.data/revert-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/revert-int.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { createBoard, createCard, getBoard, moveCard } = await import("@/server/boards");
const { revertMove, revertUpdate } = await import("./revert");

const USER = "01HREVERT0000000000000000001";

async function columns(boardId: string) {
  const payload = await getBoard(USER, boardId);
  const [first, second] = payload.columns;
  if (!first || !second) throw new Error("board needs two columns");
  return { first, second };
}

describe("undo/redo reversals (spec 6.1)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values({
      id: USER,
      email: "revert-int@example.test",
      name: "Revert",
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  it("puts a card back where it came from without the client sending a version", async () => {
    const board = await createBoard(USER, { name: "Revert move", template: "blank" });
    const { first, second } = await columns(board.id);
    const a = await createCard(USER, { boardId: board.id, columnId: first.id, title: "a" });
    const b = await createCard(USER, { boardId: board.id, columnId: first.id, title: "b" });

    // Move `b` to the other column, as a drag would.
    await moveCard(USER, {
      cardId: b.id,
      version: b.version,
      toColumnId: second.id,
      prevCardId: null,
      nextCardId: null,
    });

    // Undo: intent only — the service reads the current version itself.
    const restored = await revertMove(USER, {
      cardId: b.id,
      toColumnId: first.id,
      prevCardId: a.id,
      nextCardId: null,
    });
    expect(restored.column_id).toBe(first.id);
    expect(restored.position > a.position).toBe(true);

    const payload = await getBoard(USER, board.id);
    const order = payload.cards
      .filter((card) => card.column_id === first.id)
      .sort((x, y) => (x.position < y.position ? -1 : 1))
      .map((card) => card.title);
    expect(order).toEqual(["a", "b"]);
  });

  it("restores the previous field values for an update, and can replay it", async () => {
    const board = await createBoard(USER, { name: "Revert update", template: "blank" });
    const { first } = await columns(board.id);
    const card = await createCard(USER, {
      boardId: board.id,
      columnId: first.id,
      title: "before",
      priority: "p3",
    });

    const undone = await revertUpdate(USER, { cardId: card.id, title: "before", priority: "p3" });
    expect(undone.title).toBe("before");
    expect(undone.priority).toBe("p3");

    const redone = await revertUpdate(USER, { cardId: card.id, title: "after", priority: "p0" });
    expect(redone.title).toBe("after");
    expect(redone.priority).toBe("p0");
  });
});
