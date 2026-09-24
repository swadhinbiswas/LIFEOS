import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * Ambient focus timer (spec §6.7): the running session is a database row, so the status line shows
 * it on every page and it can be stopped from anywhere — not only from /focus.
 */
test("focus: the timer is ambient in the status line", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("focus-status");

  await createVerifiedUser(page, email);
  await signIn(page, email);

  await page.goto("/focus");
  await page.getByRole("button", { name: "start 25:00" }).click();
  await expect(page.locator('[data-slot="focus-status"]')).toHaveText("session running");

  // Navigate away: the shell still shows the session and its clock.
  await page.goto("/tasks");
  const statusLine = page.locator('footer[data-slot="status-line"]');
  await expect(statusLine).toContainText("focus");
  await expect(statusLine).toContainText(/\d\d:\d\d/u);

  // And it can be stopped from here, which logs the block.
  await page.getByRole("button", { name: "stop focus" }).click();
  await expect(statusLine).not.toContainText("focus");

  await page.goto("/focus");
  await expect(page.locator('[data-slot="focus-status"]')).toHaveText("no session running");
  await expect(page.locator('[data-slot="focus-row"]')).toHaveCount(1);
});
