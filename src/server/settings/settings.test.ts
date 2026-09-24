/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import that
// reaches src/env.ts. Unique per process (vitest collects and runs a file in separate processes).
const DB_FILE = `.data/settings-int-${process.pid}`;
process.env.DATABASE_URL = `file:${DB_FILE}.db`;
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`${DB_FILE}.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { getUserDayKey, getRegionalSettings, getTimeZone, setTimeZone, setWeekStart } =
  await import("./index");

const USER = "01HSET000000000000000000001";
/** 23:30 UTC — already the next day in Kolkata (+05:30). */
const BOUNDARY = new Date("2026-09-24T23:30:00.000Z");

describe("settings: timezone (spec 6.9, adr-057)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values({
      id: USER,
      email: "settings@example.test",
      name: USER,
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  it("defaults to UTC, then buckets the day in the saved zone", async () => {
    expect(await getTimeZone(USER)).toBe("UTC");
    expect(await getUserDayKey(USER, BOUNDARY)).toBe("2026-09-24");

    await setTimeZone(USER, "Asia/Kolkata");
    expect(await getTimeZone(USER)).toBe("Asia/Kolkata");
    expect(await getUserDayKey(USER, BOUNDARY)).toBe("2026-09-25");
  });

  it("refuses an unusable zone by falling back to UTC rather than throwing", async () => {
    await setTimeZone(USER, "Nowhere/Nope");
    expect(await getTimeZone(USER)).toBe("UTC");
  });

  it("stores the week start with the timezone, defaulting both", async () => {
    expect(await getRegionalSettings(USER)).toEqual({ timeZone: "UTC", weekStart: "mon" });

    await setWeekStart(USER, "sun");
    expect(await getRegionalSettings(USER)).toEqual({ timeZone: "UTC", weekStart: "sun" });

    await setWeekStart(USER, "bogus");
    expect((await getRegionalSettings(USER)).weekStart).toBe("mon");
  });
});
