/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import that
// reaches src/env.ts. Unique per process (vitest collects and runs a file in separate processes).
const DB_FILE = `.data/links-int-${process.pid}`;
process.env.DATABASE_URL = `file:${DB_FILE}.db`;
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`${DB_FILE}.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { createCard, ensureSystemTasksBoard, getBoard } = await import("@/server/boards");
const { createCardLink, deleteCardLink, listCardLinks, listCardOptions } = await import("./index");

const USER = "01HLINK000000000000000000001";
const OTHER = "01HLINK000000000000000000002";

describe("card links (spec 6.9, adr-056)", () => {
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

  it("links two owned cards, ignores duplicates and reads them back", async () => {
    const board = await ensureSystemTasksBoard(USER);
    const payload = await getBoard(USER, board.id);
    const inbox = payload.columns.find((column) => column.name === "Inbox");
    if (!inbox) throw new Error("the system board has no Inbox column");

    const alpha = await createCard(USER, {
      boardId: board.id,
      columnId: inbox.id,
      title: "alpha",
    });
    const beta = await createCard(USER, { boardId: board.id, columnId: inbox.id, title: "beta" });

    await createCardLink(USER, { srcId: alpha.id, dstId: beta.id, kind: "relates" });
    await createCardLink(USER, { srcId: alpha.id, dstId: beta.id, kind: "relates" }); // duplicate

    const links = await listCardLinks(USER, alpha.id);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ cardId: beta.id, title: "beta", kind: "relates" });

    // The picker offers beta but never the card being edited.
    const options = await listCardOptions(USER, alpha.id);
    expect(options.map((option) => option.title)).toContain("beta");
    expect(options.map((option) => option.id)).not.toContain(alpha.id);

    await deleteCardLink(USER, links[0]?.linkId ?? "");
    expect(await listCardLinks(USER, alpha.id)).toEqual([]);
  });

  it("refuses a self-link and another tenant's card", async () => {
    const board = await ensureSystemTasksBoard(USER);
    const payload = await getBoard(USER, board.id);
    const inbox = payload.columns.find((column) => column.name === "Inbox");
    if (!inbox) throw new Error("no Inbox column");
    const alpha = await createCard(USER, { boardId: board.id, columnId: inbox.id, title: "alpha" });
    const beta = await createCard(USER, { boardId: board.id, columnId: inbox.id, title: "beta" });

    await expect(
      createCardLink(USER, { srcId: alpha.id, dstId: alpha.id, kind: "relates" }),
    ).rejects.toThrow(/itself/u);
    await expect(
      createCardLink(OTHER, { srcId: alpha.id, dstId: beta.id, kind: "relates" }),
    ).rejects.toThrow(/card not found/u);
    expect(await listCardLinks(OTHER, alpha.id)).toEqual([]);
  });
});
