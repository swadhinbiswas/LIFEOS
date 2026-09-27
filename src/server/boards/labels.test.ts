/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database, and the assignment must precede any import
// that reaches src/env.ts (which loads .env but never overrides a set variable).
process.env.DATABASE_URL = "file:.data/labels-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/labels-int.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { BoardError, createBoard, createCard, getBoard, attachLabels } = await import("./index");
const {
  cardLabels,
  cardLabelsFor,
  createBoardLabel,
  deleteBoardLabel,
  labelsForBoard,
  listBoardLabels,
  normalizeLabelName,
  setCardLabels,
} = await import("./labels");

const USER = "01HTESTUSER0000000000000021";
const OTHER_USER = "01HTESTUSER0000000000000022";

const newUser = (id: string) => ({
  id,
  email: `${id}@example.test`,
  name: id,
  created_at: new Date(),
  updated_at: new Date(),
});

async function boardWithCards(userId = USER) {
  const board = await createBoard(userId, { name: `label board ${Math.random()}` });
  const payload = await getBoard(userId, board.id);
  const column = payload.columns[0];
  if (!column) throw new Error("board has no columns");
  const first = await createCard(userId, { boardId: board.id, columnId: column.id, title: "one" });
  const second = await createCard(userId, { boardId: board.id, columnId: column.id, title: "two" });
  return { boardId: board.id, first: first.id, second: second.id };
}

describe("board labels (spec §6.1)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values([newUser(USER), newUser(OTHER_USER)]);
  });

  it("normalises names so #Home and #home are one label", async () => {
    expect(normalizeLabelName("  Home  ")).toBe("home");
    const { boardId } = await boardWithCards();
    const first = await createBoardLabel(USER, boardId, { name: " Home ", color: "info" });
    const again = await createBoardLabel(USER, boardId, { name: "home", color: "warning" });
    expect(again.id).toBe(first.id);
    // Re-creating by name recolours, rather than refusing or duplicating.
    expect(again.color).toBe("warning");
    expect(await listBoardLabels(USER, boardId)).toHaveLength(1);
  });

  it("attaches and detaches as a set, and reports the selection", async () => {
    const { boardId, first } = await boardWithCards();
    const urgent = await createBoardLabel(USER, boardId, { name: "urgent", color: "destructive" });
    const later = await createBoardLabel(USER, boardId, { name: "later", color: "muted" });

    expect(await cardLabelsFor(USER, first)).toEqual({
      available: [later, urgent].sort((a, b) => a.name.localeCompare(b.name)),
      selected: [],
    });

    const attached = await setCardLabels(USER, first, [urgent.id]);
    expect(attached.selected).toEqual([urgent.id]);

    // The set replaces: sending both keeps both, sending one drops the other.
    await setCardLabels(USER, first, [urgent.id, later.id]);
    expect((await cardLabels(USER, first)).map((label) => label.name)).toEqual(["later", "urgent"]);
    await setCardLabels(USER, first, [later.id]);
    expect((await cardLabels(USER, first)).map((label) => label.name)).toEqual(["later"]);

    // Idempotent: the same set twice is not a duplicate or an error.
    await setCardLabels(USER, first, [later.id]);
    expect(await cardLabels(USER, first)).toHaveLength(1);
  });

  it("collects every card's labels for a board in one query", async () => {
    const { boardId, first, second } = await boardWithCards();
    const home = await createBoardLabel(USER, boardId, { name: "home", color: "info" });
    await setCardLabels(USER, first, [home.id]);

    const byCard = await labelsForBoard(USER, boardId);
    expect(byCard[first]?.map((label) => label.name)).toEqual(["home"]);
    // Absent, not an empty array, for a card with none.
    expect(byCard[second]).toBeUndefined();
    expect((await getBoard(USER, boardId)).labelsByCard[first]).toHaveLength(1);
  });

  it("keeps the capture grammar's labels pointed at the same rows", async () => {
    // `#tag` in quick capture calls attachLabels; the editor must see what it created. The capture
    // grammar hands `attachLabels` the tag without its `#` (TAG_TOKEN captures the group after it).
    const { boardId, first } = await boardWithCards();
    await attachLabels(USER, boardId, first, ["Home"]);
    const available = await listBoardLabels(USER, boardId);
    expect(available.map((label) => label.name)).toEqual(["home"]);
    expect((await cardLabels(USER, first)).map((label) => label.id)).toEqual([available[0]!.id]);
  });

  it("deletes a label and every attachment to it", async () => {
    const { boardId, first } = await boardWithCards();
    const label = await createBoardLabel(USER, boardId, { name: "temp" });
    await setCardLabels(USER, first, [label.id]);

    await deleteBoardLabel(USER, label.id);
    expect(await listBoardLabels(USER, boardId)).toEqual([]);
    expect(await cardLabels(USER, first)).toEqual([]);
    await expect(deleteBoardLabel(USER, label.id)).rejects.toBeInstanceOf(BoardError);
  });

  it("is tenant-scoped: another user cannot read, create on, or attach to a board", async () => {
    const { boardId, first } = await boardWithCards();
    const label = await createBoardLabel(USER, boardId, { name: "mine" });
    await setCardLabels(USER, first, [label.id]);

    await expect(listBoardLabels(OTHER_USER, boardId)).rejects.toBeInstanceOf(BoardError);
    await expect(createBoardLabel(OTHER_USER, boardId, { name: "theirs" })).rejects.toBeInstanceOf(
      BoardError,
    );
    await expect(cardLabelsFor(OTHER_USER, first)).rejects.toBeInstanceOf(BoardError);
    await expect(setCardLabels(OTHER_USER, first, [])).rejects.toBeInstanceOf(BoardError);
    await expect(deleteBoardLabel(OTHER_USER, label.id)).rejects.toBeInstanceOf(BoardError);

    // A label that exists, but on someone else's board, cannot be attached to my card either.
    const theirs = await createBoardLabel(OTHER_USER, (await boardWithCards(OTHER_USER)).boardId, {
      name: "not mine",
    });
    await expect(setCardLabels(USER, first, [theirs.id])).rejects.toBeInstanceOf(BoardError);

    expect((await cardLabels(USER, first)).map((entry) => entry.name)).toEqual(["mine"]);
  });
});
