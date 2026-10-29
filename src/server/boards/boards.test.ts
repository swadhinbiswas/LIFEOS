/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database. The assignment must precede any import
// that reaches src/env.ts (which loads .env but never overrides set variables).
process.env.DATABASE_URL = "file:.data/boards-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/boards-int.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { eq } = await import("drizzle-orm");
const { db } = await import("@/server/db");
const { cards, users } = await import("@/server/db/schema");
const {
  BoardError,
  REBALANCE_THRESHOLD,
  createBoard,
  createCard,
  deleteCard,
  ensureSystemTasksBoard,
  getBoard,
  listBoards,
  moveCard,
  needsRebalance,
  rebalanceColumn,
  restoreCard,
  slugify,
  updateCard,
} = await import("./index");

const USER = "01HTESTUSER0000000000000001";
const OTHER_USER = "01HTESTUSER0000000000000002";

const newUser = (id: string, email: string) => ({
  id,
  email,
  name: id,
  created_at: new Date(),
  updated_at: new Date(),
});

const columnNamed = async (boardId: string, name: string) => {
  const payload = await getBoard(USER, boardId);
  const column = payload.columns.find((candidate) => candidate.name === name);
  if (!column) throw new Error(`no column named ${name}`);
  return column;
};

const positions = (boardId: string, columnId: string) =>
  getBoard(USER, boardId).then((payload) =>
    payload.cards.filter((card) => card.column_id === columnId).map((card) => card.position),
  );

describe("board service (spec 6.1 / adrs 009, 011, 042)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db
      .insert(users)
      .values([
        newUser(USER, "boards-int@example.test"),
        newUser(OTHER_USER, "boards-other@example.test"),
      ]);
  });

  it("slugify produces URL-safe slugs", () => {
    expect(slugify("Daily Kanban")).toBe("daily-kanban");
    expect(slugify("  Trip   Planner!  ")).toBe("trip-planner");
    expect(slugify("###")).toBe("board");
  });

  it("creates a board from a template with seeded, ordered columns", async () => {
    const board = await createBoard(USER, { name: "Daily Kanban", template: "daily-kanban" });
    expect(board.slug).toBe("daily-kanban");
    expect(board.template).toBe("daily-kanban");

    const payload = await getBoard(USER, board.id);
    expect(payload.columns.map((column) => column.name)).toEqual([
      "Backlog",
      "Today",
      "Doing",
      "Done",
    ]);
    // ADR-009: positions are byte-ordered and strictly ascending.
    const keys = payload.columns.map((column) => column.position);
    expect([...keys].sort()).toEqual(keys);
    const done = payload.columns.find((column) => column.name === "Done");
    expect(done?.is_done).toBe(true);
  });

  it("gives two boards with the same name distinct slugs", async () => {
    const first = await createBoard(USER, { name: "Project", template: "project" });
    const second = await createBoard(USER, { name: "Project", template: "project" });
    expect(first.slug).toBe("project");
    expect(second.slug).toBe("project-2");
  });

  it("creates the per-user Tasks board once, with the ADR-042 columns", async () => {
    const first = await ensureSystemTasksBoard(USER);
    const second = await ensureSystemTasksBoard(USER);
    expect(second.id).toBe(first.id);

    const payload = await getBoard(USER, first.id);
    expect(payload.columns.map((column) => column.name)).toEqual([
      "Inbox",
      "Today",
      "Upcoming",
      "Someday",
      "Done",
    ]);
    expect(first.is_system).toBe(true);

    const again = await ensureSystemTasksBoard(USER);
    const columns = (await getBoard(USER, again.id)).columns;
    expect(columns).toHaveLength(5); // no duplicate seeding
  });

  it("appends cards with ascending positions and starts at version 1", async () => {
    const board = await createBoard(USER, { name: "Ordering", template: "daily-kanban" });
    const column = await columnNamed(board.id, "Today");
    const a = await createCard(USER, { boardId: board.id, columnId: column.id, title: "a" });
    const b = await createCard(USER, { boardId: board.id, columnId: column.id, title: "b" });
    expect(a.version).toBe(1);
    expect(a.position < b.position).toBe(true);

    const keys = await positions(board.id, column.id);
    expect(keys).toEqual([a.position, b.position]);
  });

  it("moves a card between neighbours with one-row semantics, bumping only that card", async () => {
    const board = await createBoard(USER, { name: "Moves", template: "daily-kanban" });
    const column = await columnNamed(board.id, "Doing");
    const a = await createCard(USER, { boardId: board.id, columnId: column.id, title: "a" });
    const b = await createCard(USER, { boardId: board.id, columnId: column.id, title: "b" });
    const c = await createCard(USER, { boardId: board.id, columnId: column.id, title: "c" });

    // c currently sorts last; drop it between a and b.
    const moved = await moveCard(USER, {
      cardId: c.id,
      version: c.version,
      toColumnId: column.id,
      prevCardId: a.id,
      nextCardId: b.id,
    });

    expect(moved.version).toBe(c.version + 1);
    expect(a.position < moved.position).toBe(true);
    expect(moved.position < b.position).toBe(true);

    const keys = await positions(board.id, column.id);
    expect(keys).toEqual([a.position, moved.position, b.position]);

    // only the moved row changed
    const reloaded = await getBoard(USER, board.id);
    const byId = new Map(reloaded.cards.map((card) => [card.id, card]));
    expect(byId.get(a.id)?.position).toBe(a.position);
    expect(byId.get(b.id)?.position).toBe(b.position);
  });

  it("completes a card on drop into a done column and re-opens it on the way out", async () => {
    const board = await createBoard(USER, { name: "Done", template: "blank" });
    const todo = await columnNamed(board.id, "To do");
    const done = await columnNamed(board.id, "Done");
    const card = await createCard(USER, { boardId: board.id, columnId: todo.id, title: "ship it" });
    expect(card.completed_at).toBeNull();

    const completed = await moveCard(USER, {
      cardId: card.id,
      version: card.version,
      toColumnId: done.id,
      prevCardId: null,
      nextCardId: null,
    });
    expect(completed.completed_at).not.toBeNull();

    const reopened = await moveCard(USER, {
      cardId: card.id,
      version: completed.version,
      toColumnId: todo.id,
      prevCardId: null,
      nextCardId: null,
    });
    expect(reopened.completed_at).toBeNull();
  });

  it("rejects stale writes with a conflict (adr-011)", async () => {
    const board = await createBoard(USER, { name: "Conflict", template: "blank" });
    const column = await columnNamed(board.id, "To do");
    const card = await createCard(USER, { boardId: board.id, columnId: column.id, title: "x" });

    const fresh = await updateCard(USER, {
      cardId: card.id,
      version: card.version,
      title: "first write",
    });
    expect(fresh.version).toBe(2);

    await expect(
      updateCard(USER, { cardId: card.id, version: card.version, title: "stale write" }),
    ).rejects.toMatchObject({ code: "conflict" });

    await expect(
      moveCard(USER, {
        cardId: card.id,
        version: card.version,
        toColumnId: column.id,
        prevCardId: null,
        nextCardId: null,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("scopes every read and write to the owning user", async () => {
    const board = await createBoard(USER, { name: "Private", template: "blank" });
    const column = await columnNamed(board.id, "To do");

    await expect(getBoard(OTHER_USER, board.id)).rejects.toBeInstanceOf(BoardError);
    await expect(
      createCard(OTHER_USER, { boardId: board.id, columnId: column.id, title: "intruder" }),
    ).rejects.toMatchObject({ code: "not_found" });

    const mine = await listBoards(USER);
    expect(mine.some((row) => row.id === board.id)).toBe(true);
    const theirs = await listBoards(OTHER_USER);
    expect(theirs.some((row) => row.id === board.id)).toBe(false);
  });

  it("soft-deletes and restores a card out of the board payload", async () => {
    const board = await createBoard(USER, { name: "Trash", template: "blank" });
    const column = await columnNamed(board.id, "To do");
    const card = await createCard(USER, { boardId: board.id, columnId: column.id, title: "bye" });

    await deleteCard(USER, card.id);
    let payload = await getBoard(USER, board.id);
    expect(payload.cards.some((row) => row.id === card.id)).toBe(false);

    const [raw] = await db.select().from(cards).where(eq(cards.id, card.id));
    expect(raw?.deleted_at).not.toBeNull(); // soft delete, not a row removal

    await restoreCard(USER, card.id);
    payload = await getBoard(USER, board.id);
    expect(payload.cards.some((row) => row.id === card.id)).toBe(true);
  });

  it("rebalances long keys back to short, preserving order (adr-009)", async () => {
    expect(needsRebalance(["a0", "Z".repeat(REBALANCE_THRESHOLD)])).toBe(true);
    expect(needsRebalance(["a0", "a1"])).toBe(false);

    const board = await createBoard(USER, { name: "Rebalance", template: "blank" });
    const column = await columnNamed(board.id, "To do");
    const created = [];
    for (let index = 0; index < 5; index += 1) {
      created.push(
        await createCard(USER, { boardId: board.id, columnId: column.id, title: `c${index}` }),
      );
    }
    const before = await positions(board.id, column.id);

    // Simulate key growth: long but still ordered positions.
    for (let index = 0; index < created.length; index += 1) {
      const card = created[index];
      if (!card) continue;
      await db
        .update(cards)
        .set({ position: `${"z".repeat(REBALANCE_THRESHOLD)}${index}` })
        .where(eq(cards.id, card.id));
    }
    expect(needsRebalance(await positions(board.id, column.id))).toBe(true);

    const count = await rebalanceColumn(USER, column.id);
    expect(count).toBe(5);

    const after = await positions(board.id, column.id);
    expect(after).toHaveLength(before.length);
    expect(after.every((key) => key.length < REBALANCE_THRESHOLD)).toBe(true);
    expect([...after].sort()).toEqual(after); // order preserved
  });

  it("materialises the next occurrence when a recurring card completes (spec 6.2)", async () => {
    const board = await createBoard(USER, { name: "Recurring", template: "blank" });
    const todo = await columnNamed(board.id, "To do");
    const done = await columnNamed(board.id, "Done");
    // Anchored on "tomorrow" rather than a fixed date so the assertion does not rot when the
    // environment clock moves past it: the next daily occurrence must land one day after the
    // completed card's own due date (anchored on the card, not on "today").
    const due = new Date();
    due.setUTCDate(due.getUTCDate() + 1);
    due.setUTCHours(9, 0, 0, 0);
    const expectedNext = new Date(due);
    expectedNext.setUTCDate(expectedNext.getUTCDate() + 1);

    const card = await createCard(USER, {
      boardId: board.id,
      columnId: todo.id,
      title: "water plants",
      dueAt: due,
      recurrence: "FREQ=DAILY;INTERVAL=1",
    });
    await moveCard(USER, {
      cardId: card.id,
      version: card.version,
      toColumnId: done.id,
      prevCardId: null,
      nextCardId: null,
    });

    const payload = await getBoard(USER, board.id);
    const inTodo = payload.cards.filter(
      (row) => row.title === "water plants" && row.column_id === todo.id,
    );
    expect(inTodo).toHaveLength(1); // the next occurrence, back in the first open column
    expect(inTodo[0]?.due_at?.toISOString()).toBe(expectedNext.toISOString());
    expect(inTodo[0]?.recurrence).toBe("FREQ=DAILY;INTERVAL=1");
    expect(inTodo[0]?.completed_at).toBeNull();

    const completed = payload.cards.filter(
      (row) => row.title === "water plants" && row.column_id === done.id,
    );
    expect(completed).toHaveLength(1); // the completed one stays as history
    expect(completed[0]?.completed_at).not.toBeNull();

    // A one-shot card must not spawn anything.
    const oneShot = await createCard(USER, {
      boardId: board.id,
      columnId: todo.id,
      title: "one shot",
    });
    await moveCard(USER, {
      cardId: oneShot.id,
      version: oneShot.version,
      toColumnId: done.id,
      prevCardId: null,
      nextCardId: null,
    });
    const afterOneShot = await getBoard(USER, board.id);
    expect(
      afterOneShot.cards.filter((row) => row.title === "one shot" && row.column_id === todo.id),
    ).toHaveLength(0);
  });
});
