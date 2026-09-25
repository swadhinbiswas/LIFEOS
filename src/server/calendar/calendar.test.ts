/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import that
// reaches src/env.ts. The name is unique per process because vitest collects and runs a file in
// separate processes, and a shared name makes those two race the first DDL into SQLITE_BUSY.
const DB_FILE = `.data/calendar-int-${process.pid}`;
process.env.DATABASE_URL = `file:${DB_FILE}.db`;
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`${DB_FILE}.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { createCard, ensureSystemTasksBoard, getBoard } = await import("@/server/boards");
const { addInterview, createJob } = await import("@/server/career");
const { createSubscription } = await import("@/server/finance");
const { getCalendar } = await import("./index");

const USER = "01HCAL000000000000000000001";
const OTHER = "01HCAL000000000000000000002";
const RANGE = { from: "2026-09-21", to: "2026-09-27" };

describe("calendar events (spec 6.9, adr-052)", () => {
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

  it("gathers due cards, interviews and renewals in range, oldest first", async () => {
    const board = await ensureSystemTasksBoard(USER);
    const payload = await getBoard(USER, board.id);
    const inbox = payload.columns.find((column) => column.name === "Inbox");
    if (!inbox) throw new Error("the system board has no Inbox column");

    await createCard(USER, {
      boardId: board.id,
      columnId: inbox.id,
      title: "ship the calendar",
      dueAt: new Date("2026-09-24T09:00:00.000Z"),
    });
    await createCard(USER, {
      boardId: board.id,
      columnId: inbox.id,
      title: "start something",
      startAt: new Date("2026-09-22T00:00:00.000Z"), // date-only start
    });
    await createCard(USER, {
      boardId: board.id,
      columnId: inbox.id,
      title: "next month",
      dueAt: new Date("2026-11-01T00:00:00.000Z"), // out of range
    });

    const job = await createJob(USER, { title: "Backend Engineer" });
    await addInterview(USER, {
      applicationId: job.application.id,
      kind: "tech",
      startsAt: new Date("2026-09-23T14:00:00.000Z"),
    });

    await createSubscription(USER, {
      name: "Cloud storage",
      amountMinor: 999,
      currency: "EUR",
      cadence: "month",
      renewsAt: new Date("2026-09-25T00:00:00.000Z"),
    });

    const events = await getCalendar(USER, RANGE);
    expect(events.map((event) => [event.date, event.time, event.kind])).toEqual([
      ["2026-09-22", null, "task"], // date-only start
      ["2026-09-23", "14:00", "interview"],
      ["2026-09-24", "09:00", "task"],
      ["2026-09-25", null, "subscription"], // date-only renewal
    ]);
    expect(events.map((event) => event.title)).toEqual([
      "start something",
      "Backend Engineer · tech",
      "ship the calendar",
      "Cloud storage",
    ]);

    const task = events.find((event) => event.title === "ship the calendar");
    expect(task?.href).toMatch(/^\/tasks\?card=/u);
    expect(events.find((event) => event.kind === "subscription")?.href).toBe("/finance");

    // Another user's calendar is empty.
    expect(await getCalendar(OTHER, RANGE)).toEqual([]);
  });

  it("reports a timed item at the user's local clock, not at UTC", async () => {
    // The card above is stored at 09:00Z. A user in Dhaka (+06) is looking at their calendar at
    // 15:00, so the row that reads "09:00" is a bug: the *day* was already resolved in their zone
    // (ADR-057) while the clock time was not, so the two halves of one row disagreed.
    const inDhaka = await getCalendar(USER, RANGE, "Asia/Dhaka");
    const task = inDhaka.find((event) => event.title === "ship the calendar");
    expect(task?.date).toBe("2026-09-24");
    expect(task?.time).toBe("15:00");

    // In UTC it stays 09:00, so the fix is zone-relative rather than a shifted constant.
    const inUtc = await getCalendar(USER, RANGE, "UTC");
    expect(inUtc.find((event) => event.title === "ship the calendar")?.time).toBe("09:00");

    // And the day does not move for a zone that would push it across midnight: 09:00Z is the
    // previous evening in New York, and the date-only rule must not be applied to a timed value.
    const inNewYork = await getCalendar(USER, RANGE, "America/New_York");
    const nyTask = inNewYork.find((event) => event.title === "ship the calendar");
    expect(nyTask?.date).toBe("2026-09-24");
    expect(nyTask?.time).toBe("05:00");
  });

  it("keeps a date-only item on the day the user picked", async () => {
    // Midnight UTC is 06:00 in Dhaka, so a naive local conversion would move this renewal to the
    // previous day — and the day-only inputs store UTC midnight precisely so it does not.
    for (const zone of ["UTC", "Asia/Dhaka", "America/New_York", "Pacific/Kiritimati"]) {
      const events = await getCalendar(USER, RANGE, zone);
      expect(events.find((event) => event.kind === "subscription")?.date, zone).toBe("2026-09-25");
      expect(events.find((event) => event.title === "start something")?.date, zone).toBe(
        "2026-09-22",
      );
    }
  });
});
