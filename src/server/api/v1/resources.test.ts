/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; unique per process (vitest collects and
// runs a file in separate processes, and a shared name races the first DDL into SQLITE_BUSY).
const DB_FILE = `.data/api-resources-int-${process.pid}`;
process.env.DATABASE_URL = `file:${DB_FILE}.db`;
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`${DB_FILE}.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { createApiKey } = await import("@/server/api-keys");
const collection = await import("@/app/api/v1/[resource]/route");
const item = await import("@/app/api/v1/[resource]/[id]/route");
const settingsRoute = await import("@/app/api/v1/settings/route");
const habitLogs = await import("@/app/api/v1/habits/[id]/logs/route");

const USER = "01HRES000000000000000000001";
const OTHER = "01HRES000000000000000000002";
const FULL = ["read:*", "write:tasks", "write:jobs", "write:notes", "write:life", "write:finance"];

let key = "";
let readOnly = "";
let other = "";

interface Json {
  data?: unknown;
  next_cursor?: string | null;
  error?: { code: string };
}
const asJson = async (response: Response): Promise<Json> => (await response.json()) as Json;

const headers = (token: string) => ({
  authorization: `Bearer ${token}`,
  "content-type": "application/json",
});

const get = (resource: string, token: string, query = "") =>
  collection.GET(
    new Request(`http://test/api/v1/${resource}${query}`, { headers: headers(token) }),
    {
      params: Promise.resolve({ resource }),
    },
  );
const post = (resource: string, body: unknown, token: string) =>
  collection.POST(
    new Request(`http://test/api/v1/${resource}`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ resource }) },
  );
const getOne = (resource: string, id: string, token: string) =>
  item.GET(new Request(`http://test/api/v1/${resource}/${id}`, { headers: headers(token) }), {
    params: Promise.resolve({ resource, id }),
  });
const patchOne = (resource: string, id: string, body: unknown, token: string) =>
  item.PATCH(
    new Request(`http://test/api/v1/${resource}/${id}`, {
      method: "PATCH",
      headers: headers(token),
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ resource, id }) },
  );
const deleteOne = (resource: string, id: string, token: string) =>
  item.DELETE(
    new Request(`http://test/api/v1/${resource}/${id}`, {
      method: "DELETE",
      headers: headers(token),
    }),
    {
      params: Promise.resolve({ resource, id }),
    },
  );

const created = async (resource: string, body: unknown): Promise<string> => {
  const response = await post(resource, body, key);
  expect(response.status).toBe(201);
  return ((await asJson(response)).data as { id: string }).id;
};

describe("REST resource registry (spec 9.1, adr-070)", () => {
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
    key = (await createApiKey(USER, { name: "full", scopes: FULL })).plaintext;
    readOnly = (await createApiKey(USER, { name: "read", scopes: ["read:*"] })).plaintext;
    other = (await createApiKey(OTHER, { name: "other", scopes: FULL })).plaintext;
  });

  it("serves jobs, notes, habits, goals, finance, health, learning, reviews, notifications, settings", async () => {
    // jobs
    const jobId = await created("jobs", { title: "Staff Engineer", companyName: "Acme" });
    const jobs = await asJson(await get("jobs", key));
    expect((jobs.data as Array<{ id: string }>).map((row) => row.id)).toContain(jobId);

    // notes (create → get → update → delete)
    const noteId = await created("notes", { title: "REST note", body: "hello" });
    const note = await asJson(await getOne("notes", noteId, key));
    expect((note.data as { title: string }).title).toBe("REST note");
    expect((await patchOne("notes", noteId, { pinned: true }, key)).status).toBe(200);
    expect((await deleteOne("notes", noteId, key)).status).toBe(204);
    expect((await getOne("notes", noteId, key)).status).toBe(404);

    // habits + logs
    const habitId = await created("habits", { name: "read", kind: "binary" });
    const log = await habitLogs.POST(
      new Request(`http://test/api/v1/habits/${habitId}/logs`, {
        method: "POST",
        headers: headers(key),
        body: JSON.stringify({ value: 1 }),
      }),
      { params: Promise.resolve({ id: habitId }) },
    );
    expect(log.status).toBe(201);
    const habits = await asJson(await get("habits", key));
    expect((habits.data as Array<{ id: string }>).map((row) => row.id)).toContain(habitId);

    // goals
    const goalId = await created("goals", { title: "Ship v1" });
    expect((await patchOne("goals", goalId, { status: "done" }, key)).status).toBe(200);

    // finance
    const accountId = await created("accounts", { name: "Cash", currency: "EUR" });
    await created("transactions", { accountId, amountMinor: -500 });
    const subscriptionId = await created("subscriptions", {
      name: "Cloud",
      amountMinor: 999,
      currency: "EUR",
      renewsAt: "2026-10-01T00:00:00.000Z",
    });
    expect((await deleteOne("subscriptions", subscriptionId, key)).status).toBe(204);

    // health, learning, reviews
    await created("health", { kind: "sleep", value: 7.5, unit: "h" });
    await created("courses", { title: "Rust" });
    await created("books", { title: "DDIA", author: "Kleppmann" });
    await created("reviews", {
      period: "weekly",
      answers: {
        wins: "w",
        lessons: "l",
        next: "n",
        clearedInbox: true,
        reviewedBoards: true,
        reviewedGoals: true,
      },
    });

    // notifications (list) + settings (get/patch)
    expect((await get("notifications", key)).status).toBe(200);
    const regional = await asJson(
      await settingsRoute.GET(
        new Request("http://test/api/v1/settings", { headers: headers(key) }),
      ),
    );
    expect(regional.data).toMatchObject({ timeZone: "UTC", weekStart: "mon" });
    const patched = await settingsRoute.PATCH(
      new Request("http://test/api/v1/settings", {
        method: "PATCH",
        headers: headers(key),
        body: JSON.stringify({ weekStart: "sun" }),
      }),
    );
    expect((await asJson(patched)).data).toMatchObject({ weekStart: "sun" });
  });

  it("enforces scopes: a read-only key cannot create", async () => {
    expect((await post("notes", { title: "nope" }, readOnly)).status).toBe(403);
    expect((await get("notes", readOnly)).status).toBe(200);
  });

  it("keeps resources tenant-isolated", async () => {
    const noteId = await created("notes", { title: "A only" });
    expect((await getOne("notes", noteId, other)).status).toBe(404);
    expect((await patchOne("notes", noteId, { title: "stolen" }, other)).status).toBe(404);
    const otherNotes = await asJson(await get("notes", other));
    expect((otherNotes.data as Array<{ id: string }>).map((row) => row.id)).not.toContain(noteId);
  });

  it("returns 404 for an unknown resource", async () => {
    expect((await get("wormholes", key)).status).toBe(404);
  });
});
