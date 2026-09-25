import { expect, test, type Page } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

const openCustomize = async (page: Page): Promise<void> => {
  const details = page.locator('[data-slot="dashboard-customize"]');
  const isOpen = await details.evaluate((el) => (el as HTMLDetailsElement).open);
  if (!isOpen) await details.locator("summary").click();
};

/**
 * Dashboard layout (spec §6.8, ADR-046): widgets can be hidden and reordered, and both survive a
 * reload because the layout is stored per user per variant. The controls live behind a collapsed
 * "customize" disclosure so the dashboard itself stays uncluttered.
 */
test("dashboard: widget visibility and order persist", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("dash-layout");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/dashboard?variant=overview");

  // The controls start collapsed; a keyboard/pointer click on the summary opens them.
  await expect(page.locator('[data-slot="layout-controls"]')).toBeHidden();
  await openCustomize(page);

  // Hide the habit-streak widget, then reload: it stays hidden.
  await page.getByLabel("show habit streaks").uncheck();
  await expect(page.locator('[data-slot="layout-controls"]')).toContainText("layout saved");
  await page.reload();
  await expect(page.getByLabel("show habit streaks")).not.toBeChecked();
  await expect(page.getByRole("heading", { name: "habit streaks", level: 2 })).toHaveCount(0);

  // Move the KPI cards down one slot, then reload: the order is kept.
  await openCustomize(page);
  await page.getByLabel("move KPIs down").click();
  await expect(page.locator('[data-slot="layout-controls"]')).toContainText("layout saved");
  await page.reload();
  await openCustomize(page);
  const controls = page.locator('[data-slot="layout-controls"] li');
  await expect(controls.first()).toContainText("habit streaks");
  await expect(controls.nth(1)).toContainText("KPIs");
});
