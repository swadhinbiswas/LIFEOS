import { expect, test, type Page } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * A column section by name. Attribute-based on purpose: while the detail sheet (a modal) is
 * open, Radix marks the board `aria-hidden`, so role-based locators cannot see it.
 */
const column = (page: Page, name: string) =>
  page.locator(`section[data-slot="board-column"][data-column-name="${name}"]`);

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

/**
 * The card detail sheet (spec §6.1): `?card=` is a real deep link, edits go through the same
 * versioned service write, and deleting is undoable from the toast.
 */
test("card sheet: deep link, edits persist, delete is undoable", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("card");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/tasks");

  const title = "draft the release note";
  const adder = page.getByLabel("add a card to Inbox");
  await adder.click();
  await adder.fill(title);
  await adder.press("Enter");

  const created = serverCard(page, "Inbox", title);
  await expect(created).toBeVisible();
  const cardId = await created.getAttribute("data-card-id");
  expect(cardId).toBeTruthy();

  // Deep link opens the sheet on that card.
  await page.goto(`/tasks?card=${cardId}`);
  await expect(page.getByRole("dialog")).toBeVisible();

  const renamed = "draft the release note (v2)";
  const titleField = page.getByLabel("title", { exact: true });
  await expect(titleField).toHaveValue(title);
  await titleField.fill(renamed);
  await titleField.blur();
  await page.getByLabel("priority").selectOption("p1");
  await page.getByLabel("due").fill("2026-10-01");
  await page.waitForLoadState("networkidle");

  // Leave the deep link before asserting the board (the open modal hides it from a11y).
  const edited = serverCard(page, "Inbox", renamed);
  await page.goto("/tasks");
  await expect(edited).toBeVisible();
  await expect(edited).toContainText("p1");
  await expect(edited).toContainText("2026-10-01");

  // Delete → the toast offers an undo that restores the card through the service.
  await page.goto(`/tasks?card=${cardId}`);
  await page.getByRole("button", { name: "delete" }).click();
  await expect(serverCard(page, "Inbox", renamed)).toHaveCount(0);
  await page.getByRole("button", { name: "undo" }).click();
  await expect(serverCard(page, "Inbox", renamed)).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.goto("/tasks");
  await expect(serverCard(page, "Inbox", renamed)).toBeVisible();
});
