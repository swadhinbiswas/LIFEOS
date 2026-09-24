import { expect, test } from "@playwright/test";

import { createVerifiedUser, serverCard, signIn, uniqueEmail } from "./helpers";

/**
 * Phase 5 acceptance (spec §14): a key created in the UI pushes a task over the REST API and it
 * appears live on the board — the same service the web app writes through.
 */
test("rest: a UI-created key pushes a task that appears on the board", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("apiv1");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/settings/integrations");

  await page.getByLabel("key name").fill("curl key");
  await page.getByRole("checkbox", { name: "write:tasks" }).check();
  await page.getByRole("button", { name: "create key" }).click();

  const token = await page.locator('[data-slot="api-key-plaintext"] code').innerText();
  expect(token.startsWith("lifeos_live_")).toBe(true);

  const response = await request.post("/api/v1/cards", {
    headers: { authorization: `Bearer ${token}` },
    data: { title: "pushed by api" },
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { data: { title: string } };
  expect(body.data.title).toBe("pushed by api");

  await page.goto("/tasks");
  await expect(serverCard(page, "Inbox", "pushed by api")).toBeVisible();
});
