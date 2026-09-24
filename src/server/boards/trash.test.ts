/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import
// that reaches src/env.ts.
process.env.DATABASE_URL = "file:.data/trash-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/trash-int.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { eq } = await import("drizzle-orm");
const { db } = await import("@/server/db");
const { cards, users } = await import("@/server/db/schema");
const { createBoard, createCard, deleteCard, getBoard, restoreCard } =
  await import("@/server/boards");
const { listTrash, purgeCard, purgeTrash } = await import("./trash");

const USER = "01HTRASH00000000000000000001";

describe("trash (spec 6.1: soft delete, 30-day window)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values({
      id: USER,
      email: "trash-int@example.test",
      name: "Trash",
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  it("lists soft-deleted cards, restores them, and purges only trashed rows", async () => {
    const board = await createBoard(USER, { name: "Trash board", template: "blank" });
    const payload = await getBoard(USER, board.id);
    const column = payload.columns[0];
    if (!column) throw new Error("no column");

    const keep = await createCard(USER, { boardId: board.id, columnId: column.id, title: "keep" });
    const bin = await createCard(USER, { boardId: board.id, columnId: column.id, title: "bin" });

    await deleteCard(USER, bin.id);

    const trashed = await listTrash(USER, board.id);
    expect(trashed.map((card) => card.title)).toEqual(["bin"]);

    // Restore puts it back in the live payload, in its original column.
    await restoreCard(USER, bin.id);
    expect(await listTrash(USER, board.id)).toHaveLength(0);
    const live = await getBoard(USER, board.id);
    expect(live.cards.map((card) => card.title).sort()).toEqual(["bin", "keep"]);

    // "Delete forever" refuses live cards and removes trashed ones.
    await purgeCard(USER, keep.id);
    expect((await getBoard(USER, board.id)).cards).toHaveLength(2);

    await deleteCard(USER, bin.id);
    await purgeCard(USER, bin.id);
    expect(await listTrash(USER, board.id)).toHaveLength(0);
    // The row is gone, not merely hidden.
    expect(await db.select().from(cards).where(eq(cards.id, bin.id))).toHaveLength(0);

    expect(column.id).toBeTruthy();
  });

  it("purges only rows past the retention window", async () => {
    const board = await createBoard(USER, { name: "Retention", template: "blank" });
    const column = (await getBoard(USER, board.id)).columns[0];
    if (!column) throw new Error("no column");

    const recent = await createCard(USER, {
      boardId: board.id,
      columnId: column.id,
      title: "recent",
    });
    const old = await createCard(USER, { boardId: board.id, columnId: column.id, title: "old" });
    await deleteCard(USER, recent.id);
    await deleteCard(USER, old.id);

    // Backdate one deletion beyond the window.
    await db
      .update(cards)
      .set({ deleted_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) })
      .where(eq(cards.id, old.id));

    expect(await purgeTrash(USER)).toBe(1);
    expect((await listTrash(USER, board.id)).map((card) => card.title)).toEqual(["recent"]);
  });
});
