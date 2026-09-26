/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

/**
 * The activity cron's own contract (ADR-129).
 *
 * The route is thin on purpose — guard, throttle, loop, report — so what is worth testing is the
 * part that fails *quietly*: that the guard is airtight, and that a connection synced twenty minutes
 * ago is skipped rather than re-synced. A cron that re-fetches anyway is not a visible bug; it is a
 * rate-limit problem somebody else discovers, later.
 *
 * The service is stubbed wholesale rather than partially mocked. `isDue` and the interval are unit
 * tested against a real database in `wakatime.test.ts`; this file is about the route, and a route
 * test that needs a database has stopped being a route test.
 *
 * The other three cron routes have no tests at all. That is a gap being named, not a claim about
 * them.
 */
const CRON_SECRET = "a-cron-secret-long-enough-to-pass";

const state = vi.hoisted(() => ({
  connections: [] as Array<{ userId: string; lastSyncedAt: Date | null }>,
  synced: [] as Array<{ userId: string; days: number }>,
  /** Set to make the next sync throw, for the "one row must not abort the run" case. */
  throwOn: null as string | null,
}));

vi.mock("@/env", () => ({ env: { CRON_SECRET } }));

vi.mock("@/server/activity/wakatime", () => ({
  ACTIVITY_REFRESH: { minIntervalMs: 60 * 60 * 1000, windowDays: 2, provider: "wakatime" },
  isDue: (lastSyncedAt: Date | null, now: Date) =>
    !lastSyncedAt || now.getTime() - lastSyncedAt.getTime() >= 60 * 60 * 1000,
  listDueActivityConnections: async () => state.connections,
  syncWakaTime: async (userId: string, days: number) => {
    if (state.throwOn === userId) throw new Error("provider exploded");
    state.synced.push({ userId, days });
    return { ok: true, days };
  },
}));

vi.mock("@/server/settings", () => ({ getTimeZone: async () => "UTC" }));

const { GET } = await import("@/app/api/cron/activity/route");

const MINUTE = 60 * 1000;
const call = (headers: Record<string, string> = {}) =>
  GET(new Request("http://test/api/cron/activity", { headers }));
const asJson = async (headers?: Record<string, string>) =>
  (await call(headers ?? { authorization: `Bearer ${CRON_SECRET}` })).json() as Promise<{
    connections: number;
    synced: number;
    skipped: number;
    results: Array<{ userId: string; synced: boolean; reason: string }>;
  }>;

describe("GET /api/cron/activity (adr-129)", () => {
  const reset = () => {
    state.connections.length = 0;
    state.synced.length = 0;
    state.throwOn = null;
  };

  it("refuses a request with no bearer token", async () => {
    reset();
    expect((await call()).status).toBe(401);
    expect((await call({ authorization: "Bearer wrong" })).status).toBe(401);
    expect(state.synced).toEqual([]);
  });

  it("accepts the configured secret and reports an empty run honestly", async () => {
    reset();
    const response = await call({ authorization: `Bearer ${CRON_SECRET}` });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ connections: 0, synced: 0, skipped: 0 });
  });

  it("skips a connection that synced inside the interval", async () => {
    reset();
    state.connections.push({ userId: "u1", lastSyncedAt: new Date(Date.now() - 20 * MINUTE) });
    const body = await asJson();
    expect(body).toMatchObject({ connections: 1, synced: 0, skipped: 1 });
    expect(state.synced).toEqual([]);
    expect(body.results[0]?.reason).toBe("not due yet");
  });

  it("syncs a stale connection and one that has never synced, and leaves the fresh one alone", async () => {
    reset();
    state.connections.push(
      { userId: "stale", lastSyncedAt: new Date(Date.now() - 3 * 60 * MINUTE) },
      { userId: "fresh", lastSyncedAt: new Date(Date.now() - 5 * MINUTE) },
      { userId: "never", lastSyncedAt: null },
    );
    const body = await asJson();
    expect(body).toMatchObject({ connections: 3, synced: 2, skipped: 1 });
    expect(state.synced.map((s) => s.userId).sort()).toEqual(["never", "stale"]);
  });

  it("re-reads two days on a tick rather than the whole dashboard window", async () => {
    reset();
    state.connections.push({ userId: "u1", lastSyncedAt: null });
    await asJson();
    // A finished day does not change, so a month-wide hourly fetch is a month of calls to learn
    // nothing. Today is still accruing; yesterday can still move.
    expect(state.synced[0]?.days).toBe(2);
  });

  it("keeps going when one account throws, because one broken row must not abort the run", async () => {
    reset();
    state.throwOn = "boom";
    state.connections.push(
      { userId: "boom", lastSyncedAt: null },
      { userId: "fine", lastSyncedAt: null },
    );
    const body = await asJson();
    expect(body).toMatchObject({ connections: 2, synced: 1, skipped: 1 });
    expect(body.results.find((r) => r.userId === "boom")).toMatchObject({
      synced: false,
      reason: "unexpected error",
    });
    expect(state.synced.map((s) => s.userId)).toEqual(["fine"]);
  });

  it("never puts a provider secret in the response", async () => {
    reset();
    state.connections.push({ userId: "u1", lastSyncedAt: null });
    const text = JSON.stringify(await asJson());
    expect(text).not.toMatch(/key|secret|token|authorization/i);
  });
});
