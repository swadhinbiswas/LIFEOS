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
/** The tracker writes are gated on `write:jobs`, which `fullKey` deliberately does not hold. */
let jobsKey = "";

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
    jobsKey = (await createApiKey(USER, { name: "agent-jobs", scopes: ["read:*", "write:jobs"] }))
      .plaintext;
  });

  const callTool = async (name: string, args: unknown, token = jobsKey) => {
    const res = await rpc("tools/call", { name, arguments: args }, token, 2);
    const content = res.body.result?.content as Array<{ text: string }> | undefined;
    return { isError: res.body.result?.isError === true, text: content?.[0]?.text ?? "" };
  };

  it("adds, reads, updates and moves an application through the tracker tools", async () => {
    const created = await callTool("create_job_application", {
      title: "Senior Data Engineer",
      companyName: "Northwind Analytics",
      location: "Kolkata",
      fitScore: 80,
      salaryMin: 3_000_000,
      currency: "INR",
      nextAction: "ask Ravi for a referral",
      // A string date, because that is all JSON Schema's `string` gives an MCP client.
      applyBy: "2026-11-01",
    });
    expect(created.isError).toBe(false);
    const applicationId = /application (\w+)/.exec(created.text)?.[1];
    expect(applicationId).toBeTruthy();

    const listed = await callTool("list_job_applications", {});
    expect(listed.text).toContain("Senior Data Engineer");
    expect(listed.text).toContain("Northwind Analytics");
    expect(listed.text).toContain("fit strong_fit");
    // Salary is stored in minor units and said so, rather than printed as a bare 3000000.
    expect(listed.text).toContain("INR3000000");

    // A filter that matches nothing says so, instead of returning an empty string the caller has to
    // interpret as either "no applications" or "no matches".
    const filtered = await callTool("list_job_applications", { company: "Nobody Ltd" });
    expect(filtered.text).toContain("no applications match");

    const updated = await callTool("update_job_application", {
      applicationId,
      appId: "R100705",
    });
    expect(updated.isError).toBe(false);
    expect(updated.text).toContain("fit score 80");

    // Progress is derived from the stage, so it is not a writable field (ADR-128). A patch carrying
    // only `progress` therefore has nothing left to change, and must say so rather than quietly
    // reporting success on a write that never happened.
    const progressWrite = await callTool("update_job_application", { applicationId, progress: 65 });
    expect(progressWrite.isError).toBe(true);
    expect(progressWrite.text).toContain("at least one field");

    // A patch with nothing in it is a read, not a write: saying so beats silently succeeding.
    const empty = await callTool("update_job_application", { applicationId });
    expect(empty.isError).toBe(true);

    // A new application lands in the first column, Wishlist, which the template weights at 5%. The
    // row must read that — a derived number, not a stored one.
    const inWishlist = await callTool("list_job_applications", { stage: "Wishlist" });
    expect(inWishlist.text).toContain("progress 5%");

    const moved = await callTool("move_job_stage", { applicationId, toStage: "interview" });
    expect(moved.isError).toBe(false);
    expect(moved.text).toContain("now in Interview");

    const inInterview = await callTool("list_job_applications", { stage: "Interview" });
    expect(inInterview.text).toContain("progress 50%");

    // A stage that does not exist must not silently file the job somewhere plausible, and the error
    // has to name the real stages or the agent can only guess again.
    const wrong = await callTool("move_job_stage", { applicationId, toStage: "Hired" });
    expect(wrong.isError).toBe(true);
    expect(wrong.text).toContain("Offer");

    const after = await callTool("list_job_applications", { stage: "Interview" });
    expect(after.text).toContain("Senior Data Engineer");

    // A read-only key must not be able to add a row.
    const denied = await callTool("create_job_application", { title: "nope" }, readOnlyKey);
    expect(denied.isError).toBe(true);

    const noTitle = await callTool("create_job_application", { companyName: "Nameless" });
    expect(noTitle.isError).toBe(true);
  });

  it("serves the tracker as a resource", async () => {
    const res = await rpc("resources/read", { uri: "lifeos://jobs" }, readOnlyKey, 3);
    const contents = res.body.result?.contents as Array<{ text: string }> | undefined;
    const parsed = JSON.parse(contents?.[0]?.text ?? "[]") as Array<{ position: string }>;
    expect(parsed.map((row) => row.position)).toContain("Senior Data Engineer");

    const missing = await rpc("resources/read", { uri: "lifeos://jobs/nope" }, readOnlyKey, 4);
    expect(missing.body.error?.code).toBe(-32602);
    expect(missing.body.error?.message).toContain("not found");
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
      "list_job_applications",
      "create_job_application",
      "update_job_application",
      "move_job_stage",
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
