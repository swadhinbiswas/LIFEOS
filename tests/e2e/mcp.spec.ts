import { expect, test } from "@playwright/test";

import { createVerifiedUser, serverCard, signIn, uniqueEmail } from "./helpers";

/**
 * Phase 5 acceptance (spec §14): a key created in the UI drives the MCP server over the real
 * JSON-RPC/Streamable-HTTP handshake — `initialize`, `tools/list`, then `search`, `create_card`,
 * `move_card` and `get_daily_brief` — and the moved card is live on the board.
 */
test("mcp: the four tools run over the wire with a UI-created key", async ({ page, request }) => {
  test.setTimeout(120_000);
  const email = uniqueEmail("mcp");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/settings/integrations");

  await page.getByLabel("key name").fill("mcp agent");
  await page.getByRole("checkbox", { name: "write:tasks" }).check();
  await page.getByRole("button", { name: "create key" }).click();
  const token = await page.locator('[data-slot="api-key-plaintext"] code').innerText();

  const headers = { authorization: `Bearer ${token}` };
  const rpc = async (method: string, params: unknown) => {
    const response = await request.post("/api/mcp", {
      headers,
      data: { jsonrpc: "2.0", id: 1, method, params },
    });
    expect(response.ok()).toBe(true);
    return (await response.json()) as {
      result?: { content?: Array<{ text: string }>; tools?: Array<{ name: string }> };
      error?: { code: number };
    };
  };
  const textOf = (body: { result?: { content?: Array<{ text: string }> } }) =>
    body.result?.content?.[0]?.text ?? "";

  const init = await rpc("initialize", { protocolVersion: "2026-07-28" });
  expect((init.result as { serverInfo?: { name: string } })?.serverInfo?.name).toBe("LifeOS");

  const tools = await rpc("tools/list", {});
  expect((tools.result?.tools ?? []).map((tool) => tool.name)).toEqual([
    "search",
    "create_card",
    "move_card",
    "get_daily_brief",
    "list_resumes",
    "get_resume",
    "propose_resume_edit",
  ]);

  const created = await rpc("tools/call", {
    name: "create_card",
    arguments: { title: "agent-made card" },
  });
  const createdText = textOf(created);
  expect(createdText).toContain("created card");
  const cardId = createdText.replace("created card ", "").split(":")[0] as string;

  const moved = await rpc("tools/call", {
    name: "move_card",
    arguments: { cardId, toColumnName: "Today" },
  });
  expect(textOf(moved)).toContain("moved agent-made card to Today");

  const found = await rpc("tools/call", { name: "search", arguments: { query: "agent-made" } });
  expect(textOf(found)).toContain(cardId);

  const brief = await rpc("tools/call", { name: "get_daily_brief", arguments: {} });
  expect(textOf(brief)).toContain("open:");

  // The agent's move is live in the app, not a parallel copy.
  await page.goto("/tasks");
  await expect(serverCard(page, "Today", "agent-made card")).toBeVisible();
});
