/** @vitest-environment node */
import { rmSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; unique per process (vitest collects and
// runs a file in separate processes, and a shared name races the first DDL into SQLITE_BUSY).
const DB_FILE = `.data/mcp-sdk-int-${process.pid}`;
process.env.DATABASE_URL = `file:${DB_FILE}.db`;
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`${DB_FILE}.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { createApiKey } = await import("@/server/api-keys");
const mcp = await import("@/app/api/mcp/route");

const USER = "01HMCPSDK0000000000000000001";
let token = "";

async function toWebRequest(request: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) for (const item of value) headers.append(key, item);
    else if (value !== undefined) headers.set(key, value);
  }
  return new Request(`http://${request.headers.host}${request.url}`, {
    method: request.method,
    headers,
    body,
  });
}

async function writeWebResponse(response: Response, target: ServerResponse): Promise<void> {
  target.statusCode = response.status;
  response.headers.forEach((value, key) => target.setHeader(key, value));
  target.end(Buffer.from(await response.arrayBuffer()));
}

const textOf = (result: unknown): string => {
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content ?? [];
  return content.map((part) => part.text ?? "").join("\n");
};

describe("MCP with the official SDK client (spec 9.2, adr-071)", () => {
  let server: ReturnType<typeof createServer>;
  let client: Client;

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values({
      id: USER,
      email: "mcp-sdk@example.test",
      name: "MCP SDK",
      created_at: new Date(),
      updated_at: new Date(),
    });
    token = (
      await createApiKey(USER, { name: "sdk", scopes: ["read:*", "write:tasks", "write:life"] })
    ).plaintext;

    server = createServer(async (request, response) => {
      try {
        const web = await toWebRequest(request);
        const result =
          request.method === "POST"
            ? await mcp.POST(web)
            : request.method === "GET"
              ? mcp.GET()
              : mcp.DELETE();
        await writeWebResponse(result, response);
      } catch (caught) {
        response.statusCode = 500;
        response.end(String(caught));
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;

    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${port}/api/mcp`),
      {
        requestInit: { headers: { authorization: `Bearer ${token}` } },
      },
    );
    client = new Client({ name: "lifeos-vitest", version: "1.0.0" });
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close().catch(() => undefined);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("completes the handshake and lists tools, resources and prompts", async () => {
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual([
      "search",
      "create_card",
      "move_card",
      "get_daily_brief",
    ]);

    const resources = await client.listResources();
    expect(resources.resources.map((resource) => resource.uri)).toContain("lifeos://brief");

    const prompts = await client.listPrompts();
    expect(prompts.prompts.map((prompt) => prompt.name)).toContain("daily-plan");
  });

  it("runs the four tools through the real client", async () => {
    const created = await client.callTool({
      name: "create_card",
      arguments: { title: "sdk-made card" },
    });
    const createdText = textOf(created);
    expect(createdText).toContain("created card");
    const cardId = createdText.replace("created card ", "").split(":")[0] as string;

    const moved = await client.callTool({
      name: "move_card",
      arguments: { cardId, toColumnName: "Today" },
    });
    expect(textOf(moved)).toContain("moved sdk-made card to Today");

    const found = await client.callTool({ name: "search", arguments: { query: "sdk-made" } });
    expect(textOf(found)).toContain(cardId);

    const brief = await client.callTool({ name: "get_daily_brief", arguments: {} });
    expect(textOf(brief)).toContain("open:");
  });

  it("reads a resource and gets a prompt", async () => {
    const read = await client.readResource({ uri: "lifeos://brief" });
    expect((read.contents[0] as { text: string }).text).toContain("open:");

    const prompt = await client.getPrompt({ name: "job-follow-up", arguments: { minDays: "3" } });
    expect((prompt.messages[0]?.content as { text: string }).text).toContain("3 days");
  });
});
