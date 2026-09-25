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
