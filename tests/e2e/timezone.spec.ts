import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * Timezone preference (spec §6.9, ADR-057): choosing a zone saves it and a reload keeps it.
 */
test("timezone: the profile saves a zone and it survives a reload", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("tz");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/settings");

  const zone = page.getByLabel("timezone");
  await expect(zone).toHaveValue("UTC");

  await zone.selectOption("Asia/Kolkata");
  await page.getByRole("button", { name: "save timezone" }).click();
  await expect(page.locator('[data-slot="time-zone-status"]')).toHaveText("saved");

  await page.reload();
  await expect(page.getByLabel("timezone")).toHaveValue("Asia/Kolkata");
});
