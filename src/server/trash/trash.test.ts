/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import
// that reaches src/env.ts. The name is unique per process because vitest collects and runs a
// file in separate processes, and a stable name makes those two open the same file and race the
// first DDL into SQLITE_BUSY.
const DB_FILE = `.data/trash-int-${process.pid}`;
process.env.DATABASE_URL = `file:${DB_FILE}.db`;
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`${DB_FILE}.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { eq, sql } = await import("drizzle-orm");
const { db } = await import("@/server/db");
const { cards, users } = await import("@/server/db/schema");
const { createCard, deleteCard, ensureSystemTasksBoard, getBoard } =
  await import("@/server/boards");
const { createNote, deleteNote, getNote, searchNotes } = await import("@/server/notes");
const { listTrash, purgeExpiredItems, purgeItem, restoreItem } = await import("./index");

const USER = "01HTRASH00000000000000000001";
const OTHER = "01HTRASH00000000000000000002";

describe("trash across cards and notes (spec 6.9, adr-048)", () => {
  beforeAll(async () => {
    // Waits rather than failing if an earlier store still holds the file for a moment.
    await db.run(sql`pragma busy_timeout = 10000`);
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

  it("lists and restores a trashed card, tenant-scoped", async () => {
    const board = await ensureSystemTasksBoard(USER);
    const payload = await getBoard(USER, board.id);
    const inbox = payload.columns.find((column) => column.name === "Inbox");
    if (!inbox) throw new Error("the system board has no Inbox column");

    const card = await createCard(USER, {
      boardId: board.id,
      columnId: inbox.id,
      title: "card to lose",
    });
    await deleteCard(USER, card.id);

    const page = await listTrash(USER);
    const row = page.items.find((item) => item.id === card.id);
    expect(row?.kind).toBe("card");
    expect(row?.context).toBe("Tasks");
    expect(await listTrash(OTHER)).toMatchObject({ items: [] });

    await restoreItem(USER, "card", card.id);
    expect((await listTrash(USER)).items.map((item) => item.id)).not.toContain(card.id);
    const restored = await getBoard(USER, board.id);
    expect(restored.cards.map((c) => c.id)).toContain(card.id);
  });

  it("restoring a note re-indexes it and rebuilds its backlinks", async () => {
    const target = await createNote(USER, { title: "Restore target", body: "the target" });
    const source = await createNote(USER, {
      title: "Restore source",
      body: "links to [[Restore target]]",
    });

    await deleteNote(USER, source.id);
    expect((await searchNotes(USER, "links")).map((hit) => hit.id)).not.toContain(source.id);

    const trashed = (await listTrash(USER)).items.find((item) => item.id === source.id);
    expect(trashed?.kind).toBe("note");

    await restoreItem(USER, "note", source.id);

    // Searchable again...
    expect((await searchNotes(USER, "links")).map((hit) => hit.id)).toContain(source.id);
    // ...and the backlink it carried is back on the target.
    const detail = await getNote(USER, target.id);
    expect(detail?.backlinks.map((note) => note.id)).toContain(source.id);
  });

  it("purges expired rows on read and hard-deletes only trashed ones", async () => {
    const board = await ensureSystemTasksBoard(USER);
    const payload = await getBoard(USER, board.id);
    const inbox = payload.columns.find((column) => column.name === "Inbox");
    if (!inbox) throw new Error("the system board has no Inbox column");

    const fresh = await createCard(USER, {
      boardId: board.id,
      columnId: inbox.id,
      title: "fresh trash",
    });
    const old = await createCard(USER, {
      boardId: board.id,
      columnId: inbox.id,
      title: "old trash",
    });
    await deleteCard(USER, fresh.id);
    await deleteCard(USER, old.id);
    await db
      .update(cards)
      .set({ deleted_at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) })
      .where(eq(cards.id, old.id));

    const page = await listTrash(USER);
    expect(page.purged).toBe(1);
    const ids = page.items.map((item) => item.id);
    expect(ids).toContain(fresh.id);
    expect(ids).not.toContain(old.id);

    // "Delete forever" removes one trashed row and leaves live work alone.
    await purgeItem(USER, "card", fresh.id);
    expect((await listTrash(USER)).items.map((item) => item.id)).not.toContain(fresh.id);
    const stillLive = (await getBoard(USER, board.id)).cards.map((row) => row.id);
    expect(stillLive).not.toContain(fresh.id);
    expect(stillLive).not.toContain(old.id);

    expect(await purgeExpiredItems(USER)).toBe(0);
  });
});
