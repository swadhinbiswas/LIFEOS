/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import
// that reaches src/env.ts.
process.env.DATABASE_URL = "file:.data/career-prep-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/career-prep-int.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { addQuestion, addStory, listPrep } = await import("./prep");

const USER = "01HCAREERPREP0000000000000001";
const OTHER = "01HCAREERPREP0000000000000002";

describe("interview prep (spec 6.3)", () => {
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

  it("stores questions and STAR stories for the caller only", async () => {
    await addQuestion(USER, {
      question: "Describe a migration you led",
      category: "behavioural",
      difficulty: "medium",
    });
    await addStory(USER, {
      title: "Cut checkout latency",
      result: "p95 down 40% with no incidents",
    });

    const prep = await listPrep(USER);
    expect(prep.questions).toHaveLength(1);
    expect(prep.questions[0]).toMatchObject({
      question: "Describe a migration you led",
      category: "behavioural",
      difficulty: "medium",
    });
    expect(prep.stories).toHaveLength(1);
    expect(prep.stories[0]?.result).toContain("p95 down 40%");

    // Another user sees nothing of theirs.
    const other = await listPrep(OTHER);
    expect(other.questions).toEqual([]);
    expect(other.stories).toEqual([]);
  });
});
