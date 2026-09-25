/** @vitest-environment node */
import { rmSync } from "node:fs";

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// ADR-029: this integration file owns its own database; unique per process.
const DB_FILE = ".data/activity-wakatime-int-" + process.pid;
process.env.DATABASE_URL = "file:" + DB_FILE + ".db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(DB_FILE + ".db" + suffix, { force: true });
}

// The key must exist before the module that encrypts with it is imported.
process.env.AI_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const {
  activitySeries,
  deleteConnection,
  getConnection,
  mapSummaries,
  saveConnection,
  syncWakaTime,
  topAcross,
} = await import("./wakatime");

const USER = "01HACTIVITY000000000000001";
const OTHER = "01HACTIVITY000000000000002";
const NOW = new Date("2026-09-26T12:00:00.000Z");

/**
 * A response in the shape the official WakaTime docs document for
 * GET /users/current/summaries, including the per-day AI fields.
 */
const wire = {
  data: [
    {
      grand_total: {
        total_seconds: 5400,
        ai_additions: 120,
        ai_deletions: 30,
        human_additions: 15,
        human_deletions: 4,
        ai_model_total_cost: 0.42,
      },
      languages: [
        { name: "TypeScript", total_seconds: 3000 },
        { name: "Python", total_seconds: 1500 },
        { name: "Shell", total_seconds: 400 },
        { name: "Markdown", total_seconds: 500 },
        { name: "JSON", total_seconds: 400 },
        { name: "YAML", total_seconds: 100 },
      ],
      editors: [{ name: "opencode", total_seconds: 5400 }],
      projects: [
        { name: "lifeos", total_seconds: 5400 },
        { name: "other", total_seconds: 900 },
      ],
    },
    {
      grand_total: { total_seconds: 1800 },
      languages: [{ name: "Go", total_seconds: 1800 }],
      editors: [{ name: "neovim", total_seconds: 1800 }],
      projects: [{ name: "lifeos", total_seconds: 1800 }],
    },
  ],
};

const DAYS = ["2026-09-24", "2026-09-25", "2026-09-26"] as const;

const dayAt = (offset: number): string => DAYS[offset] ?? DAYS[2];

describe("mapSummaries (ADR-110)", () => {
  it("keeps the provider numbers and derives nothing", () => {
    const rows = mapSummaries(wire, dayAt);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      day: "2026-09-24",
      seconds: 5400,
      aiAdditions: 120,
      aiDeletions: 30,
      humanAdditions: 15,
      humanDeletions: 4,
      aiCostUsd: 0.42,
    });
  });

  it("defaults a day that reports no AI activity to zero, not to a guess", () => {
    const rows = mapSummaries(wire, dayAt);
    expect(rows[1]).toMatchObject({ aiAdditions: 0, aiCostUsd: 0, seconds: 1800 });
  });

  it("keeps only the top five of a breakdown, biggest first", () => {
    const rows = mapSummaries(wire, dayAt);
    expect(rows[0]?.languages).toHaveLength(5);
    expect(rows[0]?.languages[0]).toEqual({ name: "TypeScript", seconds: 3000 });
    expect(rows[0]?.languages.map((row) => row.name)).not.toContain("YAML");
  });

  it("returns nothing for a shape it does not recognise, rather than throwing", () => {
    expect(mapSummaries({ data: "nonsense" }, dayAt)).toEqual([]);
    expect(mapSummaries(null, dayAt)).toEqual([]);
  });
});

describe("a WakaTime connection (ADR-110)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values(
      [USER, OTHER].map((id) => ({
        id,
        email: id.toLowerCase() + "@example.test",
        name: id,
        created_at: new Date(),
        updated_at: new Date(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores the key encrypted and never returns it", async () => {
    const summary = await saveConnection(USER, "waka_1234567890abcdef");
    expect(summary.provider).toBe("wakatime");
    expect(summary.hint).toMatch(/cdef$/u);
    expect(JSON.stringify(summary)).not.toContain("waka_1234");

    const again = await saveConnection(USER, "waka_replacement-key-1");
    expect(again.hint).not.toBe(summary.hint);
    expect((await getConnection(USER))?.hint).toBe(again.hint);
  });

  it("refuses a key that is obviously not one", async () => {
    await expect(saveConnection(OTHER, "short")).rejects.toThrow(/too short/u);
  });

  it("refuses to sync without a connection", async () => {
    const result = await syncWakaTime(OTHER, 7, NOW, "UTC");
    expect(result).toEqual({ ok: false, days: 0, error: "not connected" });
  });

  it("caches the days the provider reported, idempotently", async () => {
    await saveConnection(USER, "waka_1234567890abcdef");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(wire), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );

    const first = await syncWakaTime(USER, 3, NOW, "UTC");
    expect(first).toEqual({ ok: true, days: 2 });
    const series = await activitySeries(USER, 3, NOW, "UTC");
    expect(series.map((row) => row.day)).toEqual(["2026-09-24", "2026-09-25"]);
    expect(series[0]?.seconds).toBe(5400);
    expect(series[0]?.aiCostUsd).toBe(0.42);
    expect(series[0]?.editors).toEqual([{ name: "opencode", seconds: 5400 }]);

    // A second sync of the same days overwrites rather than adding: no double counting.
    await syncWakaTime(USER, 3, NOW, "UTC");
    expect(await activitySeries(USER, 3, NOW, "UTC")).toHaveLength(2);
    expect((await getConnection(USER))?.lastError).toBeNull();
  });

  it("keeps the cached days and records why when the provider fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 })),
    );
    const result = await syncWakaTime(USER, 3, NOW, "UTC");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("500");
    // Fail-open: the previous sync is still readable.
    expect(await activitySeries(USER, 3, NOW, "UTC")).toHaveLength(2);
    expect((await getConnection(USER))?.lastError).toBeTruthy();
  });

  it("keeps one user out of another", async () => {
    expect(await activitySeries(OTHER, 30, NOW, "UTC")).toEqual([]);
  });

  it("merges a breakdown across the window for the meters", async () => {
    const series = await activitySeries(USER, 30, NOW, "UTC");
    expect(topAcross(series, "projects")).toEqual([
      { name: "lifeos", seconds: 7200 },
      { name: "other", seconds: 900 },
    ]);
    expect(topAcross(series, "languages")[0]).toEqual({ name: "TypeScript", seconds: 3000 });
  });

  it("forgets the connection, and then cannot sync", async () => {
    await deleteConnection(OTHER);
    expect(await getConnection(OTHER)).toBeNull();
  });
});
