/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; unique per process (vitest collects and
// runs a file in separate processes, and a shared name races the first DDL into SQLITE_BUSY).
const DB_FILE = `.data/mcp-int-${process.pid}`;
process.env.DATABASE_URL = `file:${DB_FILE}.db`;
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`${DB_FILE}.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { createApiKey } = await import("@/server/api-keys");
const mcp = await import("@/app/api/mcp/route");

const USER = "01HMCP000000000000000000001";
let fullKey = "";
let readOnlyKey = "";

interface RpcBody {
  jsonrpc: string;
  id: unknown;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

const rpc = async (
  method: string,
  params: unknown,
  token: string | null,
  id: unknown = 1,
  origin?: string,
): Promise<{ status: number; body: RpcBody }> => {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (origin) headers.origin = origin;
  const response = await mcp.POST(
    new Request("http://test/api/mcp", {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    }),
  );
  return { status: response.status, body: (await response.json()) as RpcBody };
};

describe("MCP server /api/mcp (spec 9.2, adr-064)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values({
      id: USER,
      email: "mcp@example.test",
      name: "MCP",
      created_at: new Date(),
      updated_at: new Date(),
    });
    fullKey = (await createApiKey(USER, { name: "agent", scopes: ["read:*", "write:tasks"] }))
      .plaintext;
    readOnlyKey = (await createApiKey(USER, { name: "readonly", scopes: ["read:*"] })).plaintext;
  });

  it("requires a bearer key and rejects a foreign origin", async () => {
    const noAuth = await rpc("initialize", {}, null);
    expect(noAuth.status).toBe(401);
    const badOrigin = await rpc("initialize", {}, fullKey, 1, "http://evil.test");
    expect(badOrigin.status).toBe(403);
  });

  it("initializes, lists the tools and runs a create/search/move/brief flow", async () => {
    const init = await rpc(
      "initialize",
      { protocolVersion: "2026-07-28", capabilities: {} },
      fullKey,
    );
    expect(init.body.result?.protocolVersion).toBe("2026-07-28");
    expect(init.body.result?.serverInfo).toMatchObject({ name: "LifeOS" });

    const tools = await rpc("tools/list", {}, fullKey);
    const names = (tools.body.result?.tools as Array<{ name: string }>).map((tool) => tool.name);
    expect(names).toEqual([
      "search",
      "create_card",
      "move_card",
      "get_daily_brief",
      "list_resumes",
      "get_resume",
      "propose_resume_edit",
    ]);

    const created = await rpc(
      "tools/call",
      { name: "create_card", arguments: { title: "mcp task" } },
      fullKey,
    );
    const createdText = (created.body.result?.content as Array<{ text: string }>)[0]
      ?.text as string;
    expect(createdText).toContain("created card");
    const cardId = createdText.replace("created card ", "").split(":")[0] as string;

    const moved = await rpc(
      "tools/call",
      { name: "move_card", arguments: { cardId, toColumnName: "Today" } },
      fullKey,
    );
    expect((moved.body.result?.content as Array<{ text: string }>)[0]?.text).toContain(
      "moved mcp task to Today",
    );

    const found = await rpc(
      "tools/call",
      { name: "search", arguments: { query: "mcp task" } },
      fullKey,
    );
    expect((found.body.result?.content as Array<{ text: string }>)[0]?.text).toContain(cardId);

    const brief = await rpc("tools/call", { name: "get_daily_brief", arguments: {} }, fullKey);
    expect((brief.body.result?.content as Array<{ text: string }>)[0]?.text).toContain("open:");
  });

  it("refuses a write tool for a read-only key and reports unknown methods", async () => {
    const denied = await rpc(
      "tools/call",
      { name: "create_card", arguments: { title: "nope" } },
      readOnlyKey,
    );
    expect(denied.body.result?.isError).toBe(true);

    const unknown = await rpc("does/not/exist", {}, fullKey);
    expect(unknown.body.error?.code).toBe(-32601);

    // A notification (no id) is accepted with no body.
    const notice = await mcp.POST(
      new Request("http://test/api/mcp", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${fullKey}` },
        body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      }),
    );
    expect(notice.status).toBe(202);
  });
});
