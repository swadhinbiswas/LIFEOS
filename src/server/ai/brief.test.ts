/** @vitest-environment node */
import { rmSync } from "node:fs";

import { MockLanguageModelV4 } from "ai/test";
import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; unique per process.
const DB_FILE = ".data/ai-brief-int-" + process.pid;
process.env.DATABASE_URL = "file:" + DB_FILE + ".db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(DB_FILE + ".db" + suffix, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { eq } = await import("drizzle-orm");
const { db } = await import("@/server/db");
const { notifications, user_settings, users } = await import("@/server/db/schema");
const { briefEnabled, latestBrief, regenerateBrief } = await import("./brief");
const { deliverProactive } = await import("./proactive");

const USER = "01HBRIEF00000000000000000001";
const QUIET = "01HBRIEF00000000000000000002";
const MONDAY = new Date("2026-09-21T08:00:00.000Z");
const TUESDAY = new Date("2026-09-22T08:00:00.000Z");

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

describe("the AI brief as a readable surface (spec section 8, ADR-106)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values(
      [USER, QUIET].map((id) => ({
        id,
        email: id.toLowerCase() + "@example.test",
        name: id,
        created_at: new Date(),
        updated_at: new Date(),
      })),
    );
    await db.insert(user_settings).values([
      {
        id: "01HBRIE0000000000000000001",
        user_id: USER,
        ai_prefs: JSON.stringify({ morningBrief: "in_app", fridayReview: false, autoApprove: [] }),
      },
      {
        id: "01HBRIE0000000000000000002",
        user_id: QUIET,
        ai_prefs: JSON.stringify({ morningBrief: "off", fridayReview: false, autoApprove: [] }),
      },
    ]);
  });

  it("has nothing to show before a brief was ever written", async () => {
    expect(await latestBrief(QUIET, MONDAY)).toBeNull();
    expect(await briefEnabled(QUIET)).toBe(false);
    expect(await briefEnabled(USER)).toBe(true);
  });

  it("returns the model's text in full, not one truncated line", async () => {
    await deliverProactive(USER, "brief", MONDAY, model("Line one.\nLine two.\nLine three."));

    const brief = await latestBrief(USER, MONDAY);
    expect(brief?.isToday).toBe(true);
    expect(brief?.body).toBe("Line one.\nLine two.\nLine three.");
    expect(brief?.day).toBe("2026-09-21");
  });

  it("marks an older brief as not today's, so the widget can say so", async () => {
    const brief = await latestBrief(USER, TUESDAY);
    expect(brief?.isToday).toBe(false);
    expect(brief?.day).toBe("2026-09-21");
  });

  it("replaces today's brief on regenerate rather than stacking another", async () => {
    const result = await regenerateBrief(USER, MONDAY, model("Fresh start: ship it."));
    expect(result.ok).toBe(true);

    const rows = await db.select().from(notifications).where(eq(notifications.user_id, USER));
    const briefs = rows.filter((row) => row.dedupe_key?.startsWith("ai:brief:"));
    expect(briefs).toHaveLength(1);
    expect(briefs[0]?.body).toContain("Fresh start");
  });

  it("reports the one failure a user can act on", async () => {
    // No provider key is stored, so the model cannot resolve.
    const result = await regenerateBrief(QUIET, MONDAY);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("no provider configured");
  });
});
