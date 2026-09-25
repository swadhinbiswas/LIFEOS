import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * The AI morning brief as a readable surface (ADR-106).
 *
 * The brief is the copilot's own output, and the bug this closes is that it was delivered as one
 * ellipsised line in the notification centre. The assertions are therefore about the widget: an
 * honest empty state for an account with no brief, real text after asking for one, and still one
 * panel after a reload (a re-run replaces the day rather than stacking).
 */
test("dashboard: the morning brief is readable and can be rewritten", async ({ page }) => {
  test.setTimeout(120_000);
  const email = uniqueEmail("brief");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/dashboard?variant=today");

  // A fresh account has no brief: the widget offers the opt-in rather than an empty box.
  await expect(page.getByText("no brief yet")).toBeVisible();
  const enable = page.getByRole("link", { name: "turn on the daily brief" });
  await expect(enable).toHaveAttribute("href", "/settings/ai");

  // Asking for one writes it, and the panel comes back with readable text.
  await page.getByRole("button", { name: "write it again" }).click();
  const brief = page.locator('[data-slot="ai-brief"]');
  await expect(brief).toBeVisible();
  const text = (await brief.innerText()).trim();
  expect(text.length).toBeGreaterThan(40);

  await page.reload();
  await expect(page.locator('[data-slot="ai-brief"]')).toHaveCount(1);
});

/**
 * Starter layouts (ADR-108). Applying one is a save through the same service the reorder buttons
 * use, so the visible widget set after a reload must be exactly the template's — including the
 * widgets it leaves out.
 */
test("dashboard: a starter layout replaces the widgets on show", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("starter");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/dashboard?variant=today");

  const open = page.locator('[data-slot="dashboard-customize"] summary');
  await open.click();
  await expect(page.locator('[data-slot="template-button"]')).toHaveCount(4);

  // "the day" is brief, counts, top 3, queue and planned minutes.
  await page.getByRole("button", { name: "the day" }).click();
  const pressed = page.locator('[data-slot="template-button"][aria-pressed="true"]');
  await expect(pressed).toHaveCount(1);

  await page.reload();
  await open.click();
  const checked = page.locator('[data-slot="layout-controls"] input[type="checkbox"]:checked');
  await expect(checked).toHaveCount(5);
  await expect(page.getByRole("heading", { name: "open card queue", level: 2 })).toBeVisible();

  // The charts are not in this layout, so they are gone rather than merely hidden.
  await expect(page.locator('[data-slot="trend-chart"]')).toHaveCount(0);
});
