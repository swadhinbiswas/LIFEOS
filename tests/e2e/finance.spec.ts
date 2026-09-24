import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * Finance-lite (spec §6.6): an account, an expense against a budget, and the meter that follows —
 * all in the currency entered, with the no-advice disclaimer visible.
 */
test("finance: account, expense and budget progress", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("finance");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/finance");

  await expect(page.locator('[data-slot="finance-disclaimer"]')).toContainText(
    "not financial advice",
  );

  await page.getByLabel("account name").fill("Current");
  await page.getByLabel("opening balance").fill("1000");
  await page.getByRole("button", { name: "add account" }).click();
  await expect(page.locator('[data-slot="account-row"]', { hasText: "Current" })).toContainText(
    "1,000.00 EUR",
  );

  await page.getByLabel("budget category").fill("groceries");
  await page.getByLabel("budget limit").fill("200");
  await page.getByRole("button", { name: "set budget" }).click();

  await page.getByLabel("transaction amount").fill("50");
  await page.getByLabel("transaction category").fill("groceries");
  await page.getByRole("button", { name: "add transaction" }).click();

  const budget = page.locator('[data-slot="budget-row"]', { hasText: "groceries" });
  await expect(budget).toContainText("50.00 EUR");
  await expect(budget).toContainText("(25%)");
  await expect(page.locator('[data-slot="transaction-row"]')).toHaveCount(1);
  // The expense moved the account balance, not a cached figure.
  await expect(page.locator('[data-slot="account-row"]', { hasText: "Current" })).toContainText(
    "950.00 EUR",
  );
});
