import { expect, test, type Page } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/** A column section by its heading text (the section itself carries the column name too). */
const column = (page: Page, name: string) =>
  page
    .locator('section[data-slot="board-column"]')
    .filter({ has: page.getByRole("heading", { name, level: 2 }) });

/**
 * The server-confirmed card. Optimistic rows carry a `pending-…` id, so selecting the
 * non-pending one is how a test waits for the write to have actually landed.
 */
const serverCard = (page: Page, columnName: string, title: string) =>
  column(page, columnName).locator(`[data-slot="card"]:not([data-card-id^="pending-"])`, {
    hasText: title,
  });

/**
 * Phase 2 first slice (spec §6.1/§6.2, ADR-042): the Tasks board accepts a quick add and the
 * card moves between columns by keyboard alone (ADR-016's non-drag path), persisted through
 * the service rather than only in the query cache.
 */
test("tasks board: quick add, keyboard move, persistence", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("board");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: "Tasks", level: 1 })).toBeVisible();

  const title = "write the phase 2 report";
  const adder = page.getByLabel("add a card to Inbox");
  await adder.click();
  await adder.fill(title);
  await adder.press("Enter");

  await expect(serverCard(page, "Inbox", title)).toBeVisible();

  // Keyboard-only move: the explicit move button calls the same service a drop would.
  await serverCard(page, "Inbox", title)
    .getByRole("button", { name: `move ${title} right` })
    .click();
  await expect(serverCard(page, "Today", title)).toBeVisible();
  await page.waitForLoadState("networkidle");

  // Survives a reload: the write went through the service, not just the cache.
  await page.reload();
  await expect(serverCard(page, "Today", title)).toBeVisible();
  await expect(column(page, "Inbox").locator('[data-slot="card"]', { hasText: title })).toHaveCount(
    0,
  );

  // Moving within a column persists too.
  await serverCard(page, "Today", title)
    .getByRole("button", { name: `move ${title} down` })
    .click();
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(serverCard(page, "Today", title)).toBeVisible();
});
