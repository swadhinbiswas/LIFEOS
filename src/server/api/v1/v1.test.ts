/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; unique per process (vitest collects and
// runs a file in separate processes, and a shared name races the first DDL into SQLITE_BUSY).
const DB_FILE = `.data/api-v1-int-${process.pid}`;
process.env.DATABASE_URL = `file:${DB_FILE}.db`;
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`${DB_FILE}.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { createApiKey } = await import("@/server/api-keys");
const cardsRoute = await import("@/app/api/v1/cards/route");
const cardRoute = await import("@/app/api/v1/cards/[id]/route");

const USER = "01HV10000000000000000000001";
const OTHER = "01HV10000000000000000000002";

interface Json {
  data?: Record<string, unknown> | Array<Record<string, unknown>>;
  next_cursor?: string | null;
  error?: { code: string; message: string; request_id: string };
}

const asJson = async (response: Response): Promise<Json> => (await response.json()) as Json;

let fullKey = "";
let readOnlyKey = "";
let otherFullKey = "";

const authHeaders = (token: string, extra: Record<string, string> = {}) => ({
  authorization: `Bearer ${token}`,
  "content-type": "application/json",
  ...extra,
});

const get = (path: string, token: string | null, extra: Record<string, string> = {}) =>
  cardsRoute.GET(
    new Request(`http://test${path}`, token ? { headers: authHeaders(token, extra) } : undefined),
  );

const post = (body: unknown, token: string | null, extra: Record<string, string> = {}) =>
  cardsRoute.POST(
    new Request("http://test/api/v1/cards", {
      method: "POST",
      headers: token ? authHeaders(token, extra) : { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

const getOne = (id: string, token: string) =>
  cardRoute.GET(new Request(`http://test/api/v1/cards/${id}`, { headers: authHeaders(token) }), {
    params: Promise.resolve({ id }),
  });

const patchOne = (id: string, body: unknown, token: string, extra: Record<string, string> = {}) =>
  cardRoute.PATCH(
    new Request(`http://test/api/v1/cards/${id}`, {
      method: "PATCH",
      headers: authHeaders(token, extra),
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

describe("REST /api/v1/cards (spec 9.1, adr-063)", () => {
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
    fullKey = (await createApiKey(USER, { name: "full", scopes: ["read:*", "write:tasks"] }))
      .plaintext;
    readOnlyKey = (await createApiKey(USER, { name: "read", scopes: ["read:*"] })).plaintext;
    otherFullKey = (await createApiKey(OTHER, { name: "other", scopes: ["read:*", "write:tasks"] }))
      .plaintext;
  });

  it("requires a valid bearer key and the matching scope", async () => {
    expect((await cardsRoute.GET(new Request("http://test/api/v1/cards"))).status).toBe(401);
    expect((await post({ title: "x" }, readOnlyKey)).status).toBe(403);
    expect((await get("/api/v1/cards", "lifeos_live_bogus_key")).status).toBe(401);
  });

  it("creates a task, is idempotent on the key, and lists it", async () => {
    const created = await post({ title: "push from curl" }, fullKey, {
      "idempotency-key": "abc-1",
    });
    expect(created.status).toBe(201);
    const card = (await asJson(created)).data as { id: string; title: string; column_id: string };
    expect(card.title).toBe("push from curl");

    // Replaying the same key returns the same card, not a second one.
    const replay = await post({ title: "push from curl" }, fullKey, { "idempotency-key": "abc-1" });
    expect(replay.headers.get("idempotent-replay")).toBe("true");
    expect(((await asJson(replay)).data as { id: string }).id).toBe(card.id);

    const list = await asJson(await get("/api/v1/cards", fullKey));
    expect((list.data as Array<{ id: string }>).map((row) => row.id)).toContain(card.id);
    expect(list.next_cursor).toBeNull();

    // Sparse fields return exactly the requested keys.
    const sparse = await asJson(await get("/api/v1/cards?fields=id,title", fullKey));
    expect(Object.keys((sparse.data as Array<Record<string, unknown>>)[0] ?? {}).sort()).toEqual([
      "id",
      "title",
    ]);
  });

  it("paginates with an opaque cursor", async () => {
    await post({ title: "page one" }, fullKey);
    await post({ title: "page two" }, fullKey);

    const first = await asJson(await get("/api/v1/cards?limit=2", fullKey));
    expect(first.data as unknown[]).toHaveLength(2);
    expect(first.next_cursor).toBeTruthy();

    const second = await asJson(
      await get(`/api/v1/cards?limit=2&cursor=${first.next_cursor}`, fullKey),
    );
    expect((second.data as unknown[]).length).toBeGreaterThan(0);

    expect((await get("/api/v1/cards?cursor=not-a-cursor", fullKey)).status).toBe(400);
  });

  it("reads one card, updates it with If-Match, and rejects a stale tag", async () => {
    const created = await asJson(await post({ title: "conditional" }, fullKey));
    const id = (created.data as { id: string }).id;

    const read = await getOne(id, fullKey);
    const etag = read.headers.get("etag");
    expect(etag).toBe('"v1"');

    const updated = await patchOne(id, { title: "conditional (v2)" }, fullKey, {
      "if-match": etag!,
    });
    expect(updated.status).toBe(200);
    expect(updated.headers.get("etag")).toBe('"v2"');

    // Replaying the old tag is a precondition failure, not a silent overwrite.
    const stale = await patchOne(id, { title: "nope" }, fullKey, { "if-match": etag! });
    expect(stale.status).toBe(412);
    expect((await asJson(stale)).error?.code).toBe("precondition_failed");
  });

  it("keeps tenants isolated on every method", async () => {
    const created = await asJson(await post({ title: "private card" }, fullKey));
    const id = (created.data as { id: string }).id;

    expect((await getOne(id, otherFullKey)).status).toBe(404);
    expect((await patchOne(id, { title: "stolen" }, otherFullKey)).status).toBe(404);

    const otherList = await asJson(await get("/api/v1/cards", otherFullKey));
    expect((otherList.data as Array<{ id: string }>).map((row) => row.id)).not.toContain(id);
  });
});
