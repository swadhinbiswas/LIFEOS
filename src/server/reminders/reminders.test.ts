/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import that
// reaches src/env.ts. Unique per process: vitest collects and runs a file in separate processes.
const DB_FILE = `.data/reminders-int-${process.pid}`;
process.env.DATABASE_URL = `file:${DB_FILE}.db`;
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`${DB_FILE}.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { createCard, ensureSystemTasksBoard, getBoard } = await import("@/server/boards");
const { listNotifications, sweepNotifications } = await import("@/server/notifications");
const { clearReminder, dueReminders, getReminder, setReminder } = await import("./index");

const USER = "01HREM000000000000000000001";
const OTHER = "01HREM000000000000000000002";
const NOW = new Date("2026-09-24T12:00:00.000Z");

describe("reminders (spec 6.9, adr-054)", () => {
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

  it("sets one pending reminder per card and delivers it through the sweep", async () => {
    const board = await ensureSystemTasksBoard(USER);
    const payload = await getBoard(USER, board.id);
    const inbox = payload.columns.find((column) => column.name === "Inbox");
    if (!inbox) throw new Error("the system board has no Inbox column");

    const card = await createCard(USER, {
      boardId: board.id,
      columnId: inbox.id,
      title: "renew the domain",
    });

    await setReminder(USER, {
      entityType: "card",
      entityId: card.id,
      fireAt: new Date("2026-09-24T11:00:00.000Z"), // due before NOW
    });
    // Setting again replaces the pending one rather than stacking.
    await setReminder(USER, {
      entityType: "card",
      entityId: card.id,
      fireAt: new Date("2026-09-24T11:30:00.000Z"),
    });
    expect((await dueReminders(USER, NOW)).length).toBe(1);

    // The sweep turns it into a notification and marks it sent.
    await sweepNotifications(USER, NOW);
    const reminder = (await listNotifications(USER, NOW)).items.find((item) =>
      item.title.startsWith("reminder:"),
    );
    expect(reminder?.title).toBe("reminder: renew the domain");
    expect(reminder?.href).toBe(`/tasks?card=${card.id}`);

    expect(await dueReminders(USER, NOW)).toEqual([]);
    expect(await getReminder(USER, "card", card.id)).toBeNull();
    expect(await sweepNotifications(USER, NOW)).toBe(0);
  });

  it("clears a reminder and refuses another user's card", async () => {
    const board = await ensureSystemTasksBoard(USER);
    const payload = await getBoard(USER, board.id);
    const inbox = payload.columns.find((column) => column.name === "Inbox");
    if (!inbox) throw new Error("no Inbox column");
    const card = await createCard(USER, {
      boardId: board.id,
      columnId: inbox.id,
      title: "private card",
    });

    await setReminder(USER, {
      entityType: "card",
      entityId: card.id,
      fireAt: new Date("2026-09-25T09:00:00.000Z"),
    });
    await clearReminder(USER, "card", card.id);
    expect(await getReminder(USER, "card", card.id)).toBeNull();

    await expect(
      setReminder(OTHER, {
        entityType: "card",
        entityId: card.id,
        fireAt: new Date("2026-09-25T09:00:00.000Z"),
      }),
    ).rejects.toThrow(/card not found/u);
    expect(await dueReminders(OTHER, NOW)).toEqual([]);
  });
});
