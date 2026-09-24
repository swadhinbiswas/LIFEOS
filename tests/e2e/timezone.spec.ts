import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * Regional preference (spec §6.9, ADR-057/058): the timezone and week start save together and both
 * survive a reload.
 */
test("regional: timezone and week start save and survive a reload", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("tz");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/settings");

  await expect(page.getByLabel("timezone")).toHaveValue("UTC");
  await expect(page.getByLabel("week starts")).toHaveValue("mon");

  await page.getByLabel("timezone").selectOption("Asia/Kolkata");
  await page.getByLabel("week starts").selectOption("sun");
  await page.getByRole("button", { name: "save regional" }).click();
  await expect(page.locator('[data-slot="regional-status"]')).toHaveText("saved");

  await page.reload();
  await expect(page.getByLabel("timezone")).toHaveValue("Asia/Kolkata");
  await expect(page.getByLabel("week starts")).toHaveValue("sun");
});
