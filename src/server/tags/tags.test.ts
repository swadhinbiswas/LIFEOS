/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import that
// reaches src/env.ts. The name is unique per process because vitest collects and runs a file in
// separate processes, and a shared name makes those two race the first DDL into SQLITE_BUSY.
const DB_FILE = `.data/tags-int-${process.pid}`;
process.env.DATABASE_URL = `file:${DB_FILE}.db`;
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`${DB_FILE}.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { createNote } = await import("@/server/notes");
const { getTags, listIdsByTag, listTags, listTagsForMany, parseTagInput, setTags } =
  await import("./index");

const USER = "01HTAGS000000000000000000001";
const OTHER = "01HTAGS000000000000000000002";

describe("tags on notes (spec 6.9, adr-049)", () => {
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

  it("normalises a tag field into unique, lower-cased names", () => {
    expect(parseTagInput(" Alpha , #BETA\nalpha ,, ")).toEqual(["alpha", "beta"]);
    expect(parseTagInput("   ")).toEqual([]);
  });

  it("sets, replaces and clears a note's tags, pruning orphans", async () => {
    const note = await createNote(USER, { title: "Tagged note", body: "hello" });

    expect(
      await setTags(USER, { type: "note", id: note.id, names: [" Alpha ", "#BETA", "alpha"] }),
    ).toEqual(["alpha", "beta"]);
    expect(await getTags(USER, "note", note.id)).toEqual(["alpha", "beta"]);
    expect(await listTagsForMany(USER, "note", [note.id])).toEqual({
      [note.id]: ["alpha", "beta"],
    });
    expect((await listIdsByTag(USER, "note", "Alpha")).sort()).toEqual([note.id]);
    expect(await listTags(USER)).toEqual([
      { name: "alpha", count: 1 },
      { name: "beta", count: 1 },
    ]);

    // Replacing drops the edge and prunes the now-unused tag row.
    await setTags(USER, { type: "note", id: note.id, names: ["beta"] });
    expect(await getTags(USER, "note", note.id)).toEqual(["beta"]);
    expect(await listTags(USER)).toEqual([{ name: "beta", count: 1 }]);

    // Clearing leaves no tag rows behind.
    await setTags(USER, { type: "note", id: note.id, names: [] });
    expect(await getTags(USER, "note", note.id)).toEqual([]);
    expect(await listTags(USER)).toEqual([]);
  });

  it("is tenant-scoped and refuses a note the user does not own", async () => {
    const mine = await createNote(USER, { title: "Mine", body: "" });
    await setTags(USER, { type: "note", id: mine.id, names: ["private"] });

    expect(await listTags(OTHER)).toEqual([]);
    expect(await getTags(OTHER, "note", mine.id)).toEqual([]);

    await expect(setTags(OTHER, { type: "note", id: mine.id, names: ["stolen"] })).rejects.toThrow(
      /note not found/u,
    );
  });
});
