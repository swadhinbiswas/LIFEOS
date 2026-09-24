/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import
// that reaches src/env.ts.
process.env.DATABASE_URL = "file:.data/focus-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/focus-int.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { focusTotals, getRunningSession, listSessions, startSession, stopSession } =
  await import("./index");

const USER = "01HFOCUS000000000000000000001";
const OTHER = "01HFOCUS000000000000000000002";

describe("focus sessions (spec 6.7)", () => {
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

  it("keeps at most one running session and logs a completed block", async () => {
    const first = await startSession(USER, { plannedMin: 25 });
    expect((await getRunningSession(USER))?.id).toBe(first.id);

    // Starting again closes the first one instead of stacking sessions.
    const second = await startSession(USER, { plannedMin: 25 });
    expect((await getRunningSession(USER))?.id).toBe(second.id);
    const sessions = await listSessions(USER);
    expect(sessions).toHaveLength(2);
    expect(sessions.filter((row) => row.ended_at === null)).toHaveLength(1);

    // A block stopped early is recorded as cut short, and the total is what actually happened.
    const stopped = await stopSession(USER, second.id);
    expect(stopped.ended_at).not.toBeNull();
    expect(stopped.completed).toBe(false);

    const totals = await focusTotals(USER);
    expect(totals.sessionsToday).toBe(2);
    expect(totals.todayMin).toBeGreaterThanOrEqual(0);
    expect(totals.weekMin).toBeGreaterThanOrEqual(totals.todayMin);

    // Stopping twice is a no-op rather than an error.
    const again = await stopSession(USER, second.id);
    expect(again.ended_at?.getTime()).toBe(stopped.ended_at?.getTime());
  });

  it("keeps sessions private", async () => {
    expect(await getRunningSession(OTHER)).toBeNull();
    expect(await listSessions(OTHER)).toEqual([]);
    await expect(stopSession(OTHER, "01HNOPE00000000000000000000")).rejects.toThrow();
  });
});
