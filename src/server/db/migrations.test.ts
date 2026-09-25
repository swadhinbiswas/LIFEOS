/** @vitest-environment node */
import { copyFileSync, rmSync, writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ADR-029: own database, named per process so two files cannot race the first DDL.
const DB_FILE = `.data/drift-int-${process.pid}`;
process.env.DATABASE_URL = `file:${DB_FILE}.db`;
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`${DB_FILE}.db${suffix}`, { force: true });
}

const JOURNAL = "drizzle/meta/_journal.json";
const ORIGINAL_JOURNAL = readFileSync(JOURNAL, "utf8");

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { driftMessage, migrationDrift } = await import("@/server/db/migrations");
const { sql } = await import("drizzle-orm");

/**
 * The gap this file closes (ADR-113): CI migrated its own throwaway databases and never looked at
 * the developer's, so an unapplied migration could sit behind a green gate until a page crashed.
 */
describe("migration drift (ADR-113)", () => {
  // The freshly-migrated baseline the later cases measure against.
  let baseline: { expected: number; applied: number };

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  afterAll(() => {
    // The journal is edited below; leaving it modified would fail the gate for a reason that has
    // nothing to do with the change under test.
    writeFileSync(JOURNAL, ORIGINAL_JOURNAL);
  });

  it("reports nothing pending against a freshly migrated database", async () => {
    const drift = await migrationDrift();
    expect(drift.expected).toBeGreaterThan(0);
    expect(drift.applied).toBe(drift.expected);
    expect(drift.pending).toBe(0);
    expect(drift.orphans).toEqual([]);
    expect(driftMessage(drift)).toBeNull();
    baseline = drift;
  });

  it("counts an unapplied migration as pending, and names the fix", async () => {
    // The exact state that broke the dev server: a migration committed, never run. Simulated by
    // dropping the newest journal row. The key column is `hash` — selecting `id` deletes nothing,
    // and the applied-count assertion is what catches that mistake.
    const [newest] = await db.all<{ hash: string }>(
      sql`select hash from __drizzle_migrations order by created_at desc limit 1`,
    );
    expect(newest?.hash).toBeTruthy();

    await db.run(sql`delete from __drizzle_migrations where hash = ${newest?.hash ?? ""}`);
    expect((await migrationDrift()).applied).toBe(baseline.applied - 1);

    const drift = await migrationDrift();
    expect(drift.pending).toBe(1);

    const message = driftMessage(drift);
    expect(message).toContain("pnpm db:migrate");
    expect(message).toContain(drift.latest ?? "x");

    // Put it back, so the file leaves the database as it found it.
    await db.run(
      sql`insert into __drizzle_migrations (hash, created_at) values (${newest?.hash ?? ""}, ${Date.now()})`,
    );
    expect((await migrationDrift()).pending).toBe(0);
  });

  it("flags a migration file that the journal does not know about", async () => {
    // drizzle-kit replays the journal, not the directory. A hand-dropped .sql file is therefore
    // never applied, and a schema that exists only in one crashes at runtime forever — however many
    // times you run db:migrate. Counting .sql files instead of journal entries would miss this.
    // This check is filesystem-only, so it needs no database state of its own.
    copyFileSync(join("drizzle", "0015_slim_manta.sql"), "drizzle/9999_orphan_probe.sql");
    try {
      const drift = await migrationDrift();
      expect(drift.orphans).toContain("9999_orphan_probe.sql");
      expect(driftMessage(drift)).toContain("9999_orphan_probe.sql");
    } finally {
      rmSync("drizzle/9999_orphan_probe.sql", { force: true });
    }
    expect((await migrationDrift()).orphans).toEqual([]);
  });

  it("treats a database with no journal at all as maximally behind, not as current", async () => {
    // Runs last: dropping the journal leaves the database un-migratable, since the migrator would
    // replay every migration over existing tables.
    await db.run(sql`drop table __drizzle_migrations`);

    const drift = await migrationDrift();
    // The read failed, so every expected migration is outstanding — never a silent 0/0 "all good".
    expect(drift.applied).toBe(0);
    expect(drift.pending).toBe(drift.expected);
    expect(driftMessage(drift)).toContain("pnpm db:migrate");
  });

  it("says it cannot tell when the journal is absent, rather than claiming all clear", async () => {
    const backup = `${JOURNAL}.probe`;
    copyFileSync(JOURNAL, backup);
    try {
      rmSync(JOURNAL);
      const drift = await migrationDrift();
      expect(drift.unknown).toBe(true);
      expect(drift.pending).toBe(0);
      // Unknown is not "healthy": driftMessage stays null because there is nothing to fix, but the
      // flag is what lets a caller tell "verified current" from "could not check".
      expect(driftMessage(drift)).toBeNull();
    } finally {
      copyFileSync(backup, JOURNAL);
      rmSync(backup, { force: true });
    }
    expect((await migrationDrift()).unknown).toBe(false);
  });
});
