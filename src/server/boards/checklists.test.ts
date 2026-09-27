/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database, and the assignment must precede any import
// that reaches src/env.ts (which loads .env but never overrides a set variable).
process.env.DATABASE_URL = "file:.data/checklists-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/checklists-int.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { createBoard, createCard, getBoard, BoardError } = await import("./index");
const {
  addChecklistItem,
  checklistProgressForBoard,
  listCardChecklist,
  removeChecklistItem,
  setChecklistItemDone,
  setChecklistItemText,
} = await import("./checklists");

const USER = "01HTESTUSER0000000000000011";
const OTHER_USER = "01HTESTUSER0000000000000012";

const newUser = (id: string) => ({
  id,
  email: `${id}@example.test`,
  name: id,
  created_at: new Date(),
  updated_at: new Date(),
});

async function freshCard(userId = USER): Promise<string> {
  const board = await createBoard(userId, { name: `checklist board ${Math.random()}` });
  const payload = await getBoard(userId, board.id);
  const column = payload.columns[0];
  if (!column) throw new Error("board has no columns");
  const card = await createCard(userId, {
    boardId: board.id,
    columnId: column.id,
    title: "ship the thing",
  });
  return card.id;
}

describe("card checklists (spec §6.1)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values([newUser(USER), newUser(OTHER_USER)]);
  });

  it("starts empty, then adds, orders and completes items", async () => {
    const cardId = await freshCard();
    expect(await listCardChecklist(USER, cardId)).toEqual({
      items: [],
      progress: { done: 0, total: 0 },
    });

    const first = await addChecklistItem(USER, cardId, "write the migration");
    const second = await addChecklistItem(USER, cardId, "write the test");
    expect(second.items.map((item) => item.text)).toEqual([
      "write the migration",
      "write the test",
    ]);
    expect(second.progress).toEqual({ done: 0, total: 2 });

    const done = await setChecklistItemDone(USER, first.items[0]!.id, true);
    expect(done.progress).toEqual({ done: 1, total: 2 });
    expect(done.items[0]?.done_at).not.toBeNull();

    // Un-completing clears the timestamp rather than leaving it set.
    const undone = await setChecklistItemDone(USER, first.items[0]!.id, false);
    expect(undone.progress).toEqual({ done: 0, total: 2 });
    expect(undone.items[0]?.done_at).toBeNull();
  });

  it("renames and removes items, and removing the last one leaves an empty checklist", async () => {
    const cardId = await freshCard();
    const added = await addChecklistItem(USER, cardId, "typo");
    const itemId = added.items[0]!.id;

    const renamed = await setChecklistItemText(USER, itemId, "fixed");
    expect(renamed.items[0]?.text).toBe("fixed");

    const empty = await removeChecklistItem(USER, itemId);
    expect(empty).toEqual({ items: [], progress: { done: 0, total: 0 } });
  });

  it("reports progress per card for a board in one query, and only for cards with items", async () => {
    const board = await createBoard(USER, { name: "progress board" });
    const payload = await getBoard(USER, board.id);
    const column = payload.columns[0]!;
    const withItems = await createCard(USER, {
      boardId: board.id,
      columnId: column.id,
      title: "has subtasks",
    });
    const without = await createCard(USER, {
      boardId: board.id,
      columnId: column.id,
      title: "no subtasks",
    });

    const a = await addChecklistItem(USER, withItems.id, "one");
    await addChecklistItem(USER, withItems.id, "two");
    await setChecklistItemDone(USER, a.items[0]!.id, true);

    const progress = await checklistProgressForBoard(USER, board.id);
    expect(progress[withItems.id]).toEqual({ done: 1, total: 2 });
    // Absent, not zero: the card face draws nothing rather than a 0% bar on every ordinary card.
    expect(progress[without.id]).toBeUndefined();
    expect((await getBoard(USER, board.id)).checklistProgress[withItems.id]).toEqual({
      done: 1,
      total: 2,
    });
  });

  it("is tenant-scoped: another user cannot read, add to, or change a card's subtasks", async () => {
    const cardId = await freshCard();
    const added = await addChecklistItem(USER, cardId, "mine");
    const itemId = added.items[0]!.id;

    await expect(listCardChecklist(OTHER_USER, cardId)).rejects.toBeInstanceOf(BoardError);
    await expect(addChecklistItem(OTHER_USER, cardId, "theirs")).rejects.toBeInstanceOf(BoardError);
    await expect(setChecklistItemDone(OTHER_USER, itemId, true)).rejects.toBeInstanceOf(BoardError);
    await expect(setChecklistItemText(OTHER_USER, itemId, "hijacked")).rejects.toBeInstanceOf(
      BoardError,
    );
    await expect(removeChecklistItem(OTHER_USER, itemId)).rejects.toBeInstanceOf(BoardError);

    // …and the owner's item is untouched by the attempts.
    const mine = await listCardChecklist(USER, cardId);
    expect(mine.items.map((item) => item.text)).toEqual(["mine"]);
    expect(mine.progress).toEqual({ done: 0, total: 1 });
  });
});
