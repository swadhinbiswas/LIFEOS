/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; unique per process (vitest collects and
// runs a file in separate processes, and a shared name races the first DDL into SQLITE_BUSY).
const DB_FILE = `.data/isolation-int-${process.pid}`;
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
const mcp = await import("@/app/api/mcp/route");

const A = "01HISO0000000000000000000A";
const B = "01HISO0000000000000000000B";

interface RpcBody {
  result?: { content?: Array<{ text: string }>; isError?: boolean };
}

let keyA = "";
let keyB = "";

const jsonHeaders = (token: string) => ({
  authorization: `Bearer ${token}`,
  "content-type": "application/json",
});

const restPost = (body: unknown, token: string) =>
  cardsRoute.POST(
    new Request("http://test/api/v1/cards", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify(body),
    }),
  );

const restGet = (path: string, token: string) =>
  cardsRoute.GET(new Request(`http://test${path}`, { headers: jsonHeaders(token) }));

const restGetOne = (id: string, token: string) =>
  cardRoute.GET(new Request(`http://test/api/v1/cards/${id}`, { headers: jsonHeaders(token) }), {
    params: Promise.resolve({ id }),
  });

const restPatch = (id: string, body: unknown, token: string) =>
  cardRoute.PATCH(
    new Request(`http://test/api/v1/cards/${id}`, {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

const restDelete = (id: string, token: string) =>
  cardRoute.DELETE(
    new Request(`http://test/api/v1/cards/${id}`, {
      method: "DELETE",
      headers: jsonHeaders(token),
    }),
    { params: Promise.resolve({ id }) },
  );

const mcpCall = async (name: string, args: unknown, token: string): Promise<RpcBody> => {
  const response = await mcp.POST(
    new Request("http://test/api/mcp", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    }),
  );
  return (await response.json()) as RpcBody;
};

const textOf = (body: RpcBody): string => body.result?.content?.[0]?.text ?? "";

describe("two-user isolation across the API surfaces (spec §10, #31)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values(
      [A, B].map((id) => ({
        id,
        email: `${id.toLowerCase()}@example.test`,
        name: id,
        created_at: new Date(),
        updated_at: new Date(),
      })),
    );
    keyA = (await createApiKey(A, { name: "a", scopes: ["read:*", "write:tasks"] })).plaintext;
    keyB = (await createApiKey(B, { name: "b", scopes: ["read:*", "write:tasks"] })).plaintext;
  });

  it("REST: B can never read, update or delete A's card", async () => {
    const created = (await (await restPost({ title: "A private task" }, keyA)).json()) as {
      data: { id: string };
    };
    const id = created.data.id;

    expect((await restGetOne(id, keyB)).status).toBe(404);
    expect((await restPatch(id, { title: "stolen" }, keyB)).status).toBe(404);
    expect((await restDelete(id, keyB)).status).toBe(404);

    // B's list never contains A's card, and A's card is untouched.
    const list = (await (await restGet("/api/v1/cards", keyB)).json()) as {
      data: Array<{ id: string }>;
    };
    expect(list.data.map((row) => row.id)).not.toContain(id);
    expect((await restGetOne(id, keyA)).status).toBe(200);
  });

  it("MCP: B's tools cannot see or move A's card", async () => {
    const created = (await (await restPost({ title: "A mcp secret" }, keyA)).json()) as {
      data: { id: string };
    };
    const id = created.data.id;

    const search = await mcpCall("search", { query: "A mcp secret" }, keyB);
    expect(textOf(search)).not.toContain(id);

    const move = await mcpCall("move_card", { cardId: id, toColumnName: "Today" }, keyB);
    expect(move.result?.isError).toBe(true);
    expect(textOf(move)).toContain("card not found");

    // The brief B sees is B's own — A's card title is absent.
    const brief = await mcpCall("get_daily_brief", {}, keyB);
    expect(textOf(brief)).not.toContain("A mcp secret");
  });

  it("MCP: A cannot move B's card either", async () => {
    const created = (await (await restPost({ title: "B mcp secret" }, keyB)).json()) as {
      data: { id: string };
    };
    const move = await mcpCall(
      "move_card",
      { cardId: created.data.id, toColumnName: "Today" },
      keyA,
    );
    expect(move.result?.isError).toBe(true);
  });
});
