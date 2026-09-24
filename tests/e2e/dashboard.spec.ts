import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * Dashboard (spec §6.8): every KPI renders with a definition and a link to the list behind it,
 * and the KPI table is the accessible alternative to a chart.
 */
test("dashboard: KPIs link to their source lists", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("dash");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  await expect(page.locator('[data-slot="kpi-row"]')).toHaveCount(6);

  // Every KPI carries a plain-language definition and an "open list" link.
  const tasks = page.locator('[data-slot="kpi-row"][data-kpi="tasksDoneThisWeek"]');
  await expect(tasks).toContainText("tasks done this week");
  await expect(tasks.getByRole("link", { name: "open list" })).toHaveAttribute("href", /\/tasks/u);

  const budget = page.locator('[data-slot="kpi-row"][data-kpi="budgetRemaining"]');
  await expect(budget.getByRole("link", { name: "open list" })).toHaveAttribute(
    "href",
    /\/finance/u,
  );

  // A snapshot KPI says so rather than inventing a baseline.
  await expect(page.locator('[data-slot="kpi-row"][data-kpi="openApplications"]')).toContainText(
    "—",
  );
});
