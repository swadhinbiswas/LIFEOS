import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * Dashboard layout (spec §6.8, ADR-046): widgets can be hidden and reordered, and both survive a
 * reload because the layout is stored per user per variant.
 */
test("dashboard: widget visibility and order persist", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("dash-layout");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/dashboard?variant=overview");

  // Hide the habit-streak widget, then reload: it stays hidden.
  await page.getByLabel("show habit streaks").uncheck();
  await expect(page.locator('[data-slot="layout-controls"]')).toContainText("layout saved");
  await page.reload();
  await expect(page.getByLabel("show habit streaks")).not.toBeChecked();
  await expect(page.getByRole("heading", { name: "habit streaks", level: 2 })).toHaveCount(0);

  // Move the KPI table down one slot, then reload: the order is kept.
  await page.getByLabel("move KPI table down").click();
  await expect(page.locator('[data-slot="layout-controls"]')).toContainText("layout saved");
  await page.reload();
  const controls = page.locator('[data-slot="layout-controls"] li');
  await expect(controls.first()).toContainText("habit streaks");
  await expect(controls.nth(1)).toContainText("KPI table");
});
