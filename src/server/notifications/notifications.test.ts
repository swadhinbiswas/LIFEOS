/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import
// that reaches src/env.ts.
process.env.DATABASE_URL = "file:.data/notifications-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/notifications-int.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { eq } = await import("drizzle-orm");
const { db } = await import("@/server/db");
const { job_applications, users } = await import("@/server/db/schema");
const { createCard, ensureSystemTasksBoard, getBoard } = await import("@/server/boards");
const { createJob } = await import("@/server/career");
const { createSubscription } = await import("@/server/finance");
const { createHabit, setHabitLog } = await import("@/server/habits");
const { dayKey, shiftDay } = await import("@/server/habits/streak");
const {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  sweepNotifications,
  unreadCount,
} = await import("./index");

const USER = "01HNOTIF00000000000000000001";
const OTHER = "01HNOTIF00000000000000000002";
const NOW = new Date("2026-09-24T12:00:00.000Z");
const TODAY = dayKey(NOW);

describe("notification centre (spec 6.9, adr-047)", () => {
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

  it("sweeps one aggregate task nudge a day, idempotently and only for its user", async () => {
    const board = await ensureSystemTasksBoard(USER);
    const payload = await getBoard(USER, board.id);
    const inbox = payload.columns.find((column) => column.name === "Inbox");
    if (!inbox) throw new Error("the system board has no Inbox column");

    await createCard(USER, {
      boardId: board.id,
      columnId: inbox.id,
      title: "overdue thing",
      dueAt: new Date("2026-09-20T00:00:00.000Z"),
    });
    await createCard(USER, {
      boardId: board.id,
      columnId: inbox.id,
      title: "due today thing",
      dueAt: new Date("2026-09-24T09:00:00.000Z"),
    });
    await createCard(USER, {
      boardId: board.id,
      columnId: inbox.id,
      title: "later thing",
      dueAt: new Date("2026-09-30T00:00:00.000Z"), // future — not a nudge
    });

    expect(await sweepNotifications(USER, NOW)).toBe(1);
    const page = await listNotifications(USER, NOW);
    expect(page.unread).toBe(1);
    expect(page.items[0]?.title).toBe("1 task overdue, 1 due today");
    expect(page.items[0]?.href).toBe("/tasks");

    // The same day re-sweeps to nothing; the key, not a check-then-insert, is what stops it.
    expect(await sweepNotifications(USER, NOW)).toBe(0);
    expect((await listNotifications(USER, NOW)).items).toHaveLength(1);

    // Another user's sweep sees none of it.
    expect(await sweepNotifications(OTHER, NOW)).toBe(0);
    expect((await listNotifications(OTHER, NOW)).items).toEqual([]);
  });

  it("nudges a habit skipped yesterday while it is still active, and leaves a kept one alone", async () => {
    const missed = await createHabit(USER, { name: "drink water" });
    await setHabitLog(USER, { habitId: missed.id, date: shiftDay(TODAY, -2), value: 1 });

    const kept = await createHabit(USER, { name: "read one page" });
    await setHabitLog(USER, { habitId: kept.id, date: shiftDay(TODAY, -1), value: 1 });

    expect(await sweepNotifications(USER, NOW)).toBe(1);
    const items = (await listNotifications(USER, NOW)).items;
    const habits = items.filter((item) => item.kind === "habit");
    expect(habits).toHaveLength(1);
    expect(habits[0]?.title).toBe("missed yesterday: drink water");
    expect(habits[0]?.href).toBe("/habits");

    // Once today is logged the old nudge is not regenerated an hour later... but the day's key
    // already exists, so a fresh day (tomorrow) is the real boundary; assert it is stable today.
    expect(await sweepNotifications(USER, NOW)).toBe(0);
  });

  it("nudges a quiet application once a week, and never a terminal one", async () => {
    const quiet = await createJob(USER, { title: "Backend Engineer" });
    await db
      .update(job_applications)
      .set({
        stage_history: JSON.stringify([
          { from: null, to: "Applied", at: "2026-09-14T12:00:00.000Z" },
        ]),
      })
      .where(eq(job_applications.id, quiet.application.id));

    const done = await createJob(USER, { title: "Site Reliability Engineer" });
    await db
      .update(job_applications)
      .set({
        stage_history: JSON.stringify([
          { from: null, to: "Rejected", at: "2026-09-01T12:00:00.000Z" },
        ]),
      })
      .where(eq(job_applications.id, done.application.id));

    expect(await sweepNotifications(USER, NOW)).toBe(1);
    const jobs = (await listNotifications(USER, NOW)).items.filter((item) => item.kind === "job");
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.title).toBe("follow up: Backend Engineer");
    expect(jobs[0]?.body).toContain("no movement for 10 days");

    expect(await sweepNotifications(USER, NOW)).toBe(0); // once this week
  });

  it("nudges a subscription renewal due soon, once a week", async () => {
    await createSubscription(USER, {
      name: "Cloud storage",
      amountMinor: 999,
      currency: "EUR",
      cadence: "month",
      renewsAt: new Date("2026-09-25T00:00:00.000Z"), // tomorrow
    });

    expect(await sweepNotifications(USER, NOW)).toBe(1);
    const billing = (await listNotifications(USER, NOW)).items.filter(
      (item) => item.kind === "billing",
    );
    expect(billing).toHaveLength(1);
    expect(billing[0]?.title).toBe("renews in 1 day: Cloud storage");
    expect(billing[0]?.body).toBe("9.99 EUR / month");
    expect(billing[0]?.href).toBe("/finance");

    expect(await sweepNotifications(USER, NOW)).toBe(0);
  });

  it("marks read across the centre, scoped to the user", async () => {
    const before = await listNotifications(USER, NOW);
    expect(before.unread).toBeGreaterThan(0);
    const target = before.items[0];
    if (!target) throw new Error("expected a notification to mark");

    // Another user cannot read it.
    await markNotificationRead(OTHER, target.id);
    expect((await listNotifications(USER, NOW)).unread).toBe(before.unread);

    await markNotificationRead(USER, target.id);
    expect((await listNotifications(USER, NOW)).unread).toBe(before.unread - 1);

    await markAllNotificationsRead(USER);
    expect(await unreadCount(USER, NOW)).toBe(0);
  });
});
