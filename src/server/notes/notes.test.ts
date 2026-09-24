/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import
// that reaches src/env.ts.
process.env.DATABASE_URL = "file:.data/notes-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/notes-int.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { createNote, dailyNote, deleteNote, getNote, listNotes, searchNotes, updateNote } =
  await import("./index");

const USER = "01HNOTES000000000000000000001";
const OTHER = "01HNOTES000000000000000000002";

describe("notes, wiki links and FTS search (spec 6.5)", () => {
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

  it("indexes a note so full-text search finds it, and drops it on delete", async () => {
    const note = await createNote(USER, {
      title: "Kubernetes upgrade plan",
      body: "# Plan\n\nRoll the control plane first, then the workers.",
    });

    const hits = await searchNotes(USER, "control");
    expect(hits.map((hit) => hit.id)).toContain(note.id);
    expect(hits[0]?.snippet).toContain("[control]");

    // Prefix search works for a partially typed word.
    expect((await searchNotes(USER, "kuber")).map((hit) => hit.id)).toContain(note.id);

    // A query full of FTS syntax must not throw.
    expect(await searchNotes(USER, '"; drop "')).toEqual([]);

    await deleteNote(USER, note.id);
    expect((await searchNotes(USER, "control")).map((hit) => hit.id)).not.toContain(note.id);
    expect(await getNote(USER, note.id)).toBeNull();
  });

  it("resolves [[wiki links]] into backlinks and updates them when the body changes", async () => {
    const target = await createNote(USER, { title: "Phase 4", body: "the plan" });
    const source = await createNote(USER, {
      title: "Journal",
      body: "today I started [[Phase 4]]",
    });

    let detail = await getNote(USER, target.id);
    expect(detail?.backlinks.map((note) => note.id)).toEqual([source.id]);

    await updateNote(USER, { noteId: source.id, body: "no links now" });
    detail = await getNote(USER, target.id);
    expect(detail?.backlinks).toEqual([]);
  });

  it("opens today's note once and keeps notes private", async () => {
    const first = await dailyNote(USER, "2026-09-24");
    const second = await dailyNote(USER, "2026-09-24");
    expect(second.id).toBe(first.id);
    expect(second.kind).toBe("daily");
    expect(second.daily_date).toBe("2026-09-24");

    expect(await listNotes(OTHER)).toEqual([]);
    expect(await searchNotes(OTHER, "control")).toEqual([]);
  });
});
