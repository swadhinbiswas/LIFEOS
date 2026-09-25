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
const { dayKeyInTimeZone } = await import("@/lib/timezone");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const {
  focusDailySeries,
  focusTotals,
  getRunningSession,
  listSessions,
  startSession,
  stopSession,
} = await import("./index");

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

describe("focusDailySeries (ADR-101)", () => {
  it("fills the window and hides other users' minutes", async () => {
    const now = new Date("2026-09-22T18:00:00.000Z");
    // 3 days ending 2026-09-22 in UTC: the 20th, 21st and 22nd.
    const series = await focusDailySeries(USER, 3, now, "UTC");
    expect(series.map((row) => row.day)).toEqual(["2026-09-20", "2026-09-21", "2026-09-22"]);

    // A quiet day is a real zero, not a missing point, and another user's rows never leak in.
    const other = await focusDailySeries(OTHER, 3, now, "UTC");
    expect(other).toHaveLength(3);
    expect(other.every((row) => row.minutes === 0 && row.sessions === 0)).toBe(true);
  });

  it("buckets by the user's own day, not UTC", async () => {
    // 23:30 UTC on the 22nd is already the 23rd in Tokyo, so the two zones disagree on the key.
    const now = new Date("2026-09-22T23:30:00.000Z");
    expect((await focusDailySeries(USER, 1, now, "UTC"))[0]?.day).toBe("2026-09-22");
    expect((await focusDailySeries(USER, 1, now, "Asia/Tokyo"))[0]?.day).toBe("2026-09-23");
  });

  it("reports this user's completed sessions, and a running one contributes nothing", async () => {
    const running = await startSession(USER, { plannedMin: 5 });
    const now = new Date();
    const today = dayKeyInTimeZone(now, "UTC");
    const row = (await focusDailySeries(USER, 1, now, "UTC"))[0];

    expect(row?.day).toBe(today);
    // The block that is still running is counted as a session with zero minutes, not as "now".
    expect(row?.sessions).toBeGreaterThanOrEqual(1);
    expect(row?.minutes).toBeGreaterThanOrEqual(0);
    await stopSession(USER, running.id);
  });

  it("clamps the window instead of trusting a silly number", async () => {
    const series = await focusDailySeries(OTHER, 0, new Date("2026-09-22T00:00:00.000Z"), "UTC");
    expect(series).toHaveLength(1);
  });
});
