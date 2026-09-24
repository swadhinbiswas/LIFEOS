import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * Subscriptions tracker (spec §6.6, ADR-050): a subscription shows its month-normalised cost and
 * its renewal feeds the notification centre through the same lazy sweep.
 */
test("subscriptions: add one, see its monthly cost and a renewal nudge", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("subs");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/finance");

  const due = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.getByLabel("subscription name").fill("Cloud storage");
  await page.getByLabel("subscription amount").fill("9.99");
  await page.getByLabel("subscription renewal date").fill(due);
  await page.getByRole("button", { name: "add subscription" }).click();

  const row = page.locator('[data-slot="subscription-row"]', { hasText: "Cloud storage" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("9.99 EUR / month");
  await expect(page.locator('[data-slot="subscription-total"]')).toContainText("9.99 EUR / mo");

  // The renewal is inside the nudge window, so the centre has it without a scheduler.
  await page.goto("/notifications");
  await expect(
    page.locator('[data-slot="notification-row"]', {
      hasText: "renews in 2 days: Cloud storage",
    }),
  ).toBeVisible();
});
