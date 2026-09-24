/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import
// that reaches src/env.ts.
process.env.DATABASE_URL = "file:.data/career-analytics-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/career-analytics-int.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { eq } = await import("drizzle-orm");
const { db } = await import("@/server/db");
const { job_applications, users } = await import("@/server/db/schema");
const { getBoard } = await import("@/server/boards");
const { createJob, ensureJobBoard, moveJobStage } = await import("./index");
const { getCareerAnalytics } = await import("./analytics");

const USER = "01HCAREERANALYTICS00000000001";
const NOW = new Date("2026-09-24T12:00:00.000Z");

describe("career analytics (spec 6.3)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values({
      id: USER,
      email: "career-analytics@example.test",
      name: "Analytics",
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  it("breaks response rate down by source, counts weeks, and flags ghosted jobs", async () => {
    const board = await ensureJobBoard(USER);
    const applied = (await getBoard(USER, board.id)).columns.find((c) => c.name === "Applied");
    const rejected = (await getBoard(USER, board.id)).columns.find((c) => c.name === "Rejected");
    if (!applied || !rejected) throw new Error("pipeline stages missing");

    const linkedIn1 = await createJob(USER, { title: "L1", source: "LinkedIn" });
    const linkedIn2 = await createJob(USER, { title: "L2", source: "LinkedIn" });
    const referral = await createJob(USER, { title: "R1", source: "referral" });
    const rejectedJob = await createJob(USER, { title: "X1", source: "referral" });

    // L1 progressed one stage → LinkedIn has a response; referral did not.
    await moveJobStage(USER, {
      applicationId: linkedIn1.application.id,
      version: linkedIn1.card.version,
      toColumnId: applied.id,
      prevCardId: null,
      nextCardId: null,
    });
    const rejectedPayload = await getBoard(USER, board.id);
    const movedRejected = rejectedPayload.cards.find((card) => card.id === rejectedJob.card.id);
    if (!movedRejected) throw new Error("job missing");
    await moveJobStage(USER, {
      applicationId: rejectedJob.application.id,
      version: movedRejected.version,
      toColumnId: rejected.id,
      prevCardId: null,
      nextCardId: null,
    });

    // Fixtures: L1 and L2 this week; R1 two weeks ago; and a stale stage change for L2.
    const week = (offsetDays: number) => new Date(NOW.getTime() + offsetDays * 24 * 60 * 60 * 1000);
    const setCreated = (applicationId: string, at: Date) =>
      db
        .update(job_applications)
        .set({ created_at: at, updated_at: at })
        .where(eq(job_applications.id, applicationId));
    await setCreated(linkedIn1.application.id, week(-1));
    await setCreated(linkedIn2.application.id, week(-2));
    await setCreated(referral.application.id, week(-15));
    await setCreated(rejectedJob.application.id, week(-1));

    // L2 has not moved for 30 days → ghosted; the rejected job is terminal → not ghosted.
    await db
      .update(job_applications)
      .set({
        stage_history: JSON.stringify([
          { from: null, to: "Wishlist", at: week(-30).toISOString() },
        ]),
      })
      .where(eq(job_applications.id, linkedIn2.application.id));

    const analytics = await getCareerAnalytics(USER, NOW);

    // bySource: LinkedIn 2 jobs, 1 progressed → 0.5. referral also progressed once — a move to
    // Rejected *is* a response (the job left the first stage), which is the whole point of
    // measuring response rate rather than "not rejected".
    const linkedIn = analytics.bySource.find((row) => row.source === "LinkedIn");
    expect(linkedIn).toMatchObject({ total: 2, progressed: 1, rate: 0.5 });
    const ref = analytics.bySource.find((row) => row.source === "referral");
    expect(ref).toMatchObject({ total: 2, progressed: 1, rate: 0.5 });

    // perWeek: 8 buckets, oldest first, ending with the current week.
    expect(analytics.perWeek).toHaveLength(8);
    expect(analytics.perWeek.at(-1)?.weekStart).toBe("2026-09-21");
    const thisWeekAndLast = analytics.perWeek.slice(-2).reduce((total, w) => total + w.count, 0);
    expect(thisWeekAndLast).toBe(3); // L1 (yesterday) + X1 (yesterday) + L2 (two days ago)

    // ghosted: L2 at 30 days, and not the terminal rejection.
    expect(analytics.ghostThresholdDays).toBe(21);
    expect(analytics.ghosted.map((row) => row.title)).toEqual(["L2"]);
    expect(analytics.ghosted[0]?.days).toBe(30);
  });
});
