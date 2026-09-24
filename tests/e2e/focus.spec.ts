import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * Focus timer (spec §6.7): a session starts, survives a reload (it is a database row, not
 * component state), and stopping it logs the block.
 */
test("focus: start a session, survive a reload, stop it", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("focus");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/focus");

  await expect(page.locator('[data-slot="focus-status"]')).toHaveText("no session running");
  await page.getByRole("button", { name: "start 25:00" }).click();
  await expect(page.locator('[data-slot="focus-status"]')).toHaveText("session running");

  // The running session is in the database, so a reload keeps the clock going.
  await page.reload();
  await expect(page.locator('[data-slot="focus-status"]')).toHaveText("session running");
  await expect(page.getByRole("button", { name: "stop session" })).toBeVisible();

  await page.getByRole("button", { name: "stop session" }).click();
  await expect(page.locator('[data-slot="focus-status"]')).toHaveText("no session running");
  await expect(page.locator('[data-slot="focus-row"]')).toHaveCount(1);
});
