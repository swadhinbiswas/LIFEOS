import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * Personal API keys (spec §9.1, ADR-062): a key is shown once at creation, listed afterwards as a
 * prefix, and revoked instantly.
 */
test("api keys: create shows the token once, then list and revoke", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("apikey");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/settings/integrations");

  await page.getByLabel("key name").fill("e2e key");
  await page.getByRole("button", { name: "create key" }).click();

  const plaintext = page.locator('[data-slot="api-key-plaintext"]');
  await expect(plaintext).toBeVisible();
  await expect(plaintext).toContainText("lifeos_live_");

  const row = page.locator('[data-slot="api-key-row"]', { hasText: "e2e key" });
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute("data-revoked", "false");

  // The token is never shown again after a reload.
  await page.reload();
  await expect(page.locator('[data-slot="api-key-plaintext"]')).toHaveCount(0);
  await expect(page.locator('[data-slot="api-key-row"]', { hasText: "e2e key" })).toBeVisible();

  await page.getByRole("button", { name: "revoke e2e key" }).click();
  await expect(page.locator('[data-slot="api-key-row"]', { hasText: "e2e key" })).toHaveAttribute(
    "data-revoked",
    "true",
  );
});
