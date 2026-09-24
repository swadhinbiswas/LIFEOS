/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import
// that reaches src/env.ts.
process.env.DATABASE_URL = "file:.data/learning-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/learning-int.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { createBook, createCourse, listBooks, listCourses, setBookStatus, setCourseProgress } =
  await import("./index");

const USER = "01HLEARNING0000000000000000001";
const OTHER = "01HLEARNING0000000000000000002";

describe("learning-lite (spec 6.6)", () => {
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

  it("clamps course progress to a percentage the learner set", async () => {
    const course = await createCourse(USER, { title: "Distributed systems", provider: "MIT OCW" });
    expect(course.progress).toBe(0);

    const updated = await setCourseProgress(USER, { courseId: course.id, progress: 250 });
    expect(updated.progress).toBe(100);
    expect((await setCourseProgress(USER, { courseId: course.id, progress: -20 })).progress).toBe(
      0,
    );
    expect((await listCourses(USER))[0]?.progress).toBe(0);
  });

  it("stamps a finish date only while a book is finished", async () => {
    const book = await createBook(USER, { title: "DDIA", author: "Kleppmann" });
    expect(book.status).toBe("want");
    expect(book.finished_at).toBeNull();

    const finished = await setBookStatus(USER, { bookId: book.id, status: "finished" });
    expect(finished.finished_at).not.toBeNull();

    const rereading = await setBookStatus(USER, { bookId: book.id, status: "reading" });
    expect(rereading.finished_at).toBeNull();
  });

  it("keeps courses and books private", async () => {
    expect(await listCourses(OTHER)).toEqual([]);
    expect(await listBooks(OTHER)).toEqual([]);
  });
});
