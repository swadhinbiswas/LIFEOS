/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import
// that reaches src/env.ts.
process.env.DATABASE_URL = "file:.data/health-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/health-int.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { healthSummary, listHealth, logHealth } = await import("./index");

const USER = "01HHEALTH00000000000000000001";
const OTHER = "01HHEALTH00000000000000000002";

describe("health-lite (spec 6.6, adr-045)", () => {
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

  it("replaces a day's entry per kind and derives the week's average", async () => {
    await logHealth(USER, { kind: "sleep", value: 6, unit: "h", date: "2026-09-23" });
    await logHealth(USER, { kind: "sleep", value: 9, unit: "h", date: "2026-09-23" }); // replaces

    const rows = await listHealth(USER, { days: 28, today: "2026-09-24" });
    const sleep = rows.filter((row) => row.kind === "sleep");
    expect(sleep).toHaveLength(1);
    expect(sleep[0]?.value).toBe(9);

    await logHealth(USER, { kind: "sleep", value: 7, unit: "h", date: "2026-09-24" });
    const summary = await healthSummary(USER, "2026-09-24");
    const trend = summary.trends.find((entry) => entry.kind === "sleep");
    expect(trend?.thisWeek).toBe(8); // mean of 9 and 7
    expect(trend?.unit).toBe("h");
    expect(summary.today).toEqual([{ kind: "sleep", value: 7, unit: "h" }]);
  });

  it("ignores old entries when bucketing a window and keeps logs private", async () => {
    await logHealth(USER, { kind: "weight", value: 70, unit: "kg", date: "2026-01-01" });
    const summary = await healthSummary(USER, "2026-09-24");
    expect(summary.trends.map((entry) => entry.kind)).toEqual(["sleep"]);

    expect(await listHealth(OTHER, { days: 28, today: "2026-09-24" })).toEqual([]);
  });
});
