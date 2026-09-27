import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * AI settings and proactive cron (spec §8). Memory is user-owned and removable; the proactive cron
 * is CRON_SECRET-guarded and a no-op when nobody has opted in.
 */
test("ai settings: memory can be added and deleted", async ({ page }) => {
  test.setTimeout(120_000);
  const email = uniqueEmail("ai-settings");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/settings/ai");

  await page.locator("#ai-memory-input").fill("I prefer short answers");
  await page.locator('[data-slot="ai-memory"]').getByRole("button", { name: "add" }).click();
  const row = page.locator('[data-slot="ai-memory-row"]', { hasText: "I prefer short answers" });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "delete memory" }).click();
  await expect(row).toHaveCount(0);
});

test("proactive cron: guarded and a no-op with no opt-ins", async ({ request }) => {
  const unauthorized = await request.get("/api/cron/proactive");
  expect(unauthorized.status()).toBe(401);

  const authorized = await request.get("/api/cron/proactive", {
    headers: { authorization: "Bearer e2e-cron-secret-000000000000" },
  });
  expect(authorized.status()).toBe(200);
  const body = (await authorized.json()) as { processed: number };
  expect(body.processed).toBe(0);
});

/**
 * Command Code's provider-specific controls (ADR-134) must appear for that provider and only that
 * one. A ZDR toggle that stayed on screen for OpenAI, or a "load models" button for a provider with
 * no catalog, would be controls that do something other than what they say.
 */
test("ai settings: the command code controls are provider-scoped", async ({ page }) => {
  test.setTimeout(120_000);
  const email = uniqueEmail("ai-commandcode");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/settings/ai");

  const provider = page.locator("#ai-provider");
  const zdrLabel = page.getByText("Zero data retention (Command Code)", { exact: true });
  const loadModels = page.getByRole("button", { name: "Load available models" });

  // Not shown for the default provider.
  await expect(zdrLabel).toHaveCount(0);
  await expect(loadModels).toHaveCount(0);

  await provider.selectOption("commandcode");
  await expect(zdrLabel).toBeVisible();
  await expect(loadModels).toBeVisible();

  // The model field stays typeable with no key configured, because a model this page has never
  // heard of is still a model the user can call.
  const model = page.locator("#ai-model");
  await expect(model).toBeEditable();
  await model.fill("claude-sonnet-4-6");
  await expect(model).toHaveValue("claude-sonnet-4-6");

  // A model list needs a key, and whether one exists depends on the machine running the suite, so
  // the assertion is on the invariant rather than on a particular message: the note always says
  // what happened, and the field is still typeable either way. A blank note, or a datalist of
  // models the app made up, is the failure this pins.
  await loadModels.click();
  const note = page.locator("#catalog-label");
  await expect(note).not.toBeEmpty();
  await expect(note).toHaveText(
    /models available from your key|Could not read the model list|no Command Code key is configured/,
  );
  await expect(model).toHaveValue("claude-sonnet-4-6");
  await expect(model).toBeEditable();

  // Back to another provider, and the Command Code controls go away again.
  await provider.selectOption("openai");
  await expect(zdrLabel).toHaveCount(0);
  await expect(loadModels).toHaveCount(0);
});
