/** @vitest-environment node */
import { rmSync } from "node:fs";

import { MockLanguageModelV4 } from "ai/test";
import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; unique per process.
const DB_FILE = `.data/ai-proactive-int-${process.pid}`;
process.env.DATABASE_URL = `file:${DB_FILE}.db`;
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`${DB_FILE}.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { eq } = await import("drizzle-orm");
const { db } = await import("@/server/db");
const { notifications, user_settings, users } = await import("@/server/db/schema");
const { deliverProactive, listProactiveUsers, runProactive } = await import("./proactive");

const USER = "01HAIPR00000000000000000001";
const QUIET = "01HAIPR00000000000000000002";
const FRIDAY = new Date("2026-09-25T08:00:00.000Z"); // a Friday
const WEDNESDAY = new Date("2026-09-23T08:00:00.000Z");

const model = (text: string) =>
  new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 5, noCache: 5, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 5, text: 5, reasoning: undefined },
      },
      warnings: [],
    }),
  });

describe("proactive brief and review (spec §8)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values(
      [USER, QUIET].map((id) => ({
        id,
        email: `${id.toLowerCase()}@example.test`,
        name: id,
        created_at: new Date(),
        updated_at: new Date(),
      })),
    );
    await db.insert(user_settings).values([
      {
        id: "01HAIPRS0000000000000000001",
        user_id: USER,
        ai_prefs: JSON.stringify({ morningBrief: "in_app", fridayReview: true, autoApprove: [] }),
      },
      {
        id: "01HAIPRS0000000000000000002",
        user_id: QUIET,
        ai_prefs: JSON.stringify({ morningBrief: "off", fridayReview: false, autoApprove: [] }),
      },
    ]);
  });

  it("only lists users who opted in", async () => {
    const opted = await listProactiveUsers();
    expect(opted.map((row) => row.userId)).toEqual([USER]);
  });

  it("delivers a brief once and dedupes a retry", async () => {
    const first = await deliverProactive(
      USER,
      "brief",
      WEDNESDAY,
      model("Today: ship the report."),
    );
    expect(first.delivered).toBe(true);

    const second = await deliverProactive(
      USER,
      "brief",
      WEDNESDAY,
      model("Today: ship the report."),
    );
    expect(second.delivered).toBe(false);
    expect(second.skipped).toMatch(/already delivered/u);

    const rows = await db.select().from(notifications).where(eq(notifications.user_id, USER));
    expect(rows.filter((row) => row.kind === "system")).toHaveLength(1);
    expect(rows[0]?.body).toContain("ship the report");
  });

  it("runs the brief on any day and the review only on Friday", async () => {
    const wednesday = await runProactive(WEDNESDAY);
    expect(wednesday.map((result) => result.kind)).toEqual(["brief"]);

    const friday = await runProactive(FRIDAY);
    expect(friday.map((result) => result.kind).sort()).toEqual(["brief", "review"]);
  });
});
