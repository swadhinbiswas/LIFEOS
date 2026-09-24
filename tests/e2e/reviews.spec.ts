import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * Review wizard (spec §6.2/§6.4): answering the guided steps produces a note, the review is listed,
 * and the note is an ordinary note afterwards.
 */
test("reviews: complete a weekly review into a note", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("reviews");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/reviews");

  await page.getByLabel("clear the inbox").check();
  await page.getByLabel("review wins").fill("finished the dashboard");
  await page.getByLabel("review lessons").fill("started late");
  await page.getByLabel("review next").fill("close the notes gap");
  await page.getByRole("button", { name: "complete review" }).click();

  // The wizard lands on the note it just wrote.
  await page.waitForURL(/\/notes\/[^/]+$/u);
  await expect(page.getByLabel("note title")).toHaveValue(/Weekly review/u);
  await expect(page.getByLabel("note body markdown")).toHaveValue(/finished the dashboard/);

  // And the review is recorded, linking to that note.
  await page.goto("/reviews");
  const row = page.locator('[data-slot="review-row"]').first();
  await expect(row).toContainText("weekly");
  await expect(row.getByRole("link", { name: "open note →" })).toBeVisible();

  // It is an ordinary note, so full-text search finds it.
  await page.goto("/notes?q=dashboard");
  await expect(page.locator('[data-slot="note-row"]', { hasText: "Weekly review" })).toBeVisible();
});
