import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * Billing stays invisible and unlimited while BILLING_ENABLED=false (spec §11/§14 Ph7, ADR-082):
 * no nav entry, no upgrade UI, and the pricing page presents only the free plan.
 */
test("billing: hidden and unlimited while disabled", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("billing");

  await createVerifiedUser(page, email);
  await signIn(page, email);

  // No billing entry in the sidebar.
  await expect(page.getByRole("link", { name: "Billing" })).toHaveCount(0);

  // The page is still reachable by URL and shows the launch notice, never a paywall.
  await page.goto("/settings/billing");
  await expect(page.getByText("Free forever during launch")).toBeVisible();
  await expect(page.getByRole("button", { name: /upgrade/i })).toHaveCount(0);

  // The public pricing page presents the free plan with the coming-later note.
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { level: 1, name: "Pricing" })).toBeVisible();
  await expect(page.getByText(/Pro coming later/i)).toBeVisible();
});

/**
 * Data ownership (spec §10, ADR-083): export links exist, an import restores notes, and deletion is
 * scheduled then cancellable.
 */
test("data: export links, import a file, schedule and cancel deletion", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("data");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/settings/data");

  await expect(page.getByRole("link", { name: "full JSON export" })).toBeVisible();
  await expect(page.getByRole("link", { name: "JSON Resume" })).toBeVisible();

  await page.locator("#data-import-file").setInputFiles({
    name: "export.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ version: 1, notes: [{ title: "Imported note", body: "hello" }] }),
    ),
  });
  await expect(page.getByText(/restored 1 notes/u)).toBeVisible();

  await page.getByRole("button", { name: "request deletion" }).click();
  await expect(page.locator('[data-slot="deletion-status"]')).toContainText("scheduled");
  await page.getByRole("button", { name: "cancel deletion" }).click();
  await expect(page.locator('[data-slot="deletion-status"]')).toContainText(
    "no deletion scheduled",
  );
});
