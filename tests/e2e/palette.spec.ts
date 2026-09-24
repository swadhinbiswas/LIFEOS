import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * The command palette (spec §4.3): Ctrl+K opens it, real search finds a card and deep-links to
 * it, and the quick-capture grammar can create a task straight from the input.
 */
test("command palette: search a card, then create one from the grammar", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("palette");

  await createVerifiedUser(page, email);
  await signIn(page, email);

  await page.goto("/inbox");
  const capture = page.getByLabel("capture a task");
  await capture.fill("quarterly report draft");
  await capture.press("Enter");
  await expect(
    page.locator('[data-slot="inbox-card"]', { hasText: "quarterly report draft" }),
  ).toBeVisible();

  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog");
  await expect(palette).toBeVisible();

  await palette.getByPlaceholder(/search cards and boards/).fill("quarterly");
  const hit = palette.getByRole("option", { name: /quarterly report draft/ });
  await expect(hit).toBeVisible();
  await hit.click();

  // Selecting a card deep-links to its board with the detail sheet open.
  await page.waitForURL(/\/tasks\?card=/u);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");

  // The same input creates a task, parsed by the §4.3 grammar.
  await page.keyboard.press("Control+k");
  const paletteAgain = page.getByRole("dialog");
  await paletteAgain
    .getByPlaceholder(/search cards and boards/)
    .fill("call the bank tomorrow #errand");
  const createItem = paletteAgain.getByRole("option", { name: /create task: call the bank/ });
  await expect(createItem).toBeVisible();
  await createItem.click();

  await page.waitForURL(/\/tasks\?card=/u);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByLabel("title", { exact: true })).toHaveValue(
    "call the bank",
  );
});
