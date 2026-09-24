import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * Notes UI (spec §6.5): a note is created, saved with a `[[wiki link]]`, found by full-text
 * search, and the linked note lists it as a backlink — the round trip users actually perform.
 */
test("notes: write, search and backlink", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("notes");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/notes");

  await page.getByRole("button", { name: "new note" }).click();
  await page.waitForURL(/\/notes\/[^/]+$/u);
  await page.getByLabel("note title").fill("Kubernetes plan");
  await page.getByLabel("note body markdown").fill("roll the control plane, see [[Phase 4]]");
  await page.getByRole("button", { name: "save" }).click();
  await expect(page.locator('[data-slot="note-status"]')).toHaveText("saved");

  await page.goto("/notes?q=control");
  await expect(
    page.locator('[data-slot="note-row"]', { hasText: "Kubernetes plan" }),
  ).toBeVisible();
  await page.goto("/notes?q=nothingmatchesthis");
  await expect(page.locator('[data-slot="note-row"]')).toHaveCount(0);

  await page.goto("/notes");
  await page.getByRole("button", { name: "new note" }).click();
  await page.waitForURL(/\/notes\/[^/]+$/u);
  await page.getByLabel("note title").fill("Phase 4");
  await page.getByRole("button", { name: "save" }).click();
  await expect(page.locator('[data-slot="note-status"]')).toHaveText("saved");
  await expect(
    page.locator('[data-slot="backlink-row"]', { hasText: "Kubernetes plan" }),
  ).toBeVisible();
});
