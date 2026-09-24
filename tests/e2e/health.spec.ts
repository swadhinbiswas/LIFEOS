import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * Health-lite (spec §6.6): a log keeps the unit the user typed, feeds the weekly average, and
 * survives a reload.
 */
test("health: log sleep and see the weekly average", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("health");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/health");

  await expect(page.locator('[data-slot="health-disclaimer"]')).toContainText("nothing medical");

  await page.getByLabel("health kind").selectOption("sleep");
  await page.getByLabel("health value").fill("7");
  await page.getByLabel("health unit").fill("h");
  await page.getByRole("button", { name: "log it" }).click();

  const trend = page.locator('[data-slot="trend-row"]', { hasText: "sleep" });
  await expect(trend).toBeVisible();
  await expect(trend).toContainText("7 h this week");
  await expect(page.locator('[data-slot="health-row"]', { hasText: "sleep" })).toContainText("7 h");

  await page.reload();
  await expect(page.locator('[data-slot="trend-row"]', { hasText: "sleep" })).toContainText(
    "7 h this week",
  );
});
