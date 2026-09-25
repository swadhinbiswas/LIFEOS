/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; unique per process.
const DB_FILE = `.data/data-int-${process.pid}`;
process.env.DATABASE_URL = `file:${DB_FILE}.db`;
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`${DB_FILE}.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { createGoal } = await import("@/server/goals");
const { createHabit } = await import("@/server/habits");
const { createNote, listNotes } = await import("@/server/notes");
const { exportAll, toJsonResume } = await import("./export");
const { importData } = await import("./import");
const {
  accountDeletionStatus,
  cancelAccountDeletion,
  purgeExpiredAccounts,
  requestAccountDeletion,
} = await import("./account");

const USER = "01HDATA000000000000000000001";

describe("data ownership (spec §10, adr-083)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values({
      id: USER,
      email: "data@example.test",
      name: "Data Owner",
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  it("exports every module scoped to the user", async () => {
    await createNote(USER, { title: "Trip plan", body: "book the train" });
    await createHabit(USER, { name: "Read" });
    await createGoal(USER, { title: "Ship v1" });

    const data = await exportAll(USER, { name: "Data Owner", email: "data@example.test" });
    expect(data.version).toBe(1);
    expect(data.account.name).toBe("Data Owner");
    expect(data.notes).toHaveLength(1);
    expect(data.habits).toHaveLength(1);
    expect(data.goals).toHaveLength(1);
  });

  it("imports notes, cards, habits and goals, and reports skipped modules", async () => {
    const report = await importData(USER, {
      version: 1,
      notes: [{ title: "Imported note", body: "hello" }],
      cards: [{ title: "Imported card" }],
      habits: [{ name: "Imported habit", kind: "numeric", target: 3, unit: "glasses" }],
      goals: [{ title: "Imported goal", period: "2026-Q4" }],
      transactions: [{ amount_minor: 100 }],
    });

    expect(report).toMatchObject({ notes: 1, cards: 1, habits: 1, goals: 1 });
    expect(report.skipped).toContain("transactions");

    const notes = await listNotes(USER);
    expect(notes.some((note) => note.title === "Imported note")).toBe(true);
  });

  it("builds a JSON Resume from real data only", () => {
    const resume = toJsonResume({
      name: "Data Owner",
      skills: [{ name: "Python", level: 4 }],
      projects: [{ name: "opengrammar", language: "TypeScript" }],
    }) as { basics: { name: string }; skills: unknown[]; projects: unknown[] };
    expect(resume.basics.name).toBe("Data Owner");
    expect(resume.skills).toHaveLength(1);
    expect(resume.projects).toHaveLength(1);
  });

  it("schedules deletion with a grace period and only purges after it", async () => {
    const { purgeAfter } = await requestAccountDeletion(USER);
    expect(purgeAfter).toBeInstanceOf(Date);
    const days = (purgeAfter!.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(6.9);

    // Not yet due: nothing is purged.
    expect(await purgeExpiredAccounts(new Date())).toBe(0);

    await cancelAccountDeletion(USER);
    expect((await accountDeletionStatus(USER)).requestedAt).toBeNull();
  });
});
