import { expect, test } from "@playwright/test";

import { column, createVerifiedUser, serverCard, signIn, uniqueEmail } from "./helpers";

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
  const sheet = page.getByRole("dialog");
  const titleField = sheet.getByLabel("title", { exact: true });
  await expect(titleField).toHaveValue(title);
  await titleField.fill(renamed);
  await titleField.blur();
  await sheet.getByLabel("priority").selectOption("p1");
  await sheet.getByLabel("due").fill("2026-10-01");
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

/**
 * Table view + filters (spec §6.1): the same board data rendered through TanStack Table v9,
 * with URL-owned sorting state, quick-filter chips and grouping.
 */
test("table view: sorting, quick filters and grouping", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("table");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/tasks");

  const adder = page.getByLabel("add a card to Inbox");
  for (const title of ["alpha task", "beta task"]) {
    await adder.click();
    await adder.fill(title);
    await adder.press("Enter");
  }
  await expect(serverCard(page, "Inbox", "alpha task")).toBeVisible();
  await expect(serverCard(page, "Inbox", "beta task")).toBeVisible();

  // Give alpha a P0 so the priority filter and grouping have something to select.
  const alphaId = await serverCard(page, "Inbox", "alpha task").getAttribute("data-card-id");
  await page.goto(`/tasks?card=${alphaId}`);
  await page.getByRole("dialog").getByLabel("priority").selectOption("p0");
  await page.waitForLoadState("networkidle");
  await page.goto("/tasks");

  // Switch to the table view; the choice lands in the URL.
  await page.getByRole("button", { name: "table" }).click();
  const table = page.locator('[data-slot="board-table"]');
  await expect(table.locator('[data-slot="table-row"]')).toHaveCount(2);
  await expect(page).toHaveURL(/view=table/u);

  // Quick filter: P0–P1 keeps only alpha, and the URL carries it.
  await page.getByRole("button", { name: "P0–P1" }).click();
  await expect(table.locator('[data-slot="table-row"]')).toHaveCount(1);
  await expect(table.locator('[data-slot="table-row"]')).toContainText("alpha task");
  await expect(page).toHaveURL(/filter=p0-p1/u);

  // Clearing the chip brings both rows back.
  await page.getByRole("button", { name: "P0–P1" }).click();
  await expect(table.locator('[data-slot="table-row"]')).toHaveCount(2);

  // Sort by the card column: ascending then descending flips the first row.
  const cardHeader = table.getByRole("button", { name: "card" }).first();
  await cardHeader.click();
  await expect(table.locator('[data-slot="table-row"]').first()).toContainText("alpha task");
  await cardHeader.click();
  await expect(table.locator('[data-slot="table-row"]').first()).toContainText("beta task");

  // Grouping splits the table into per-group sections.
  await page.getByLabel("group").selectOption("priority");
  await expect(table.locator("section h2")).toHaveCount(2);
  await expect(table.locator("section", { hasText: "p0" })).toContainText("alpha task");

  // Save the current view, reload, and apply it back from the saved-views list.
  await page.getByLabel("name for the current view").fill("grouped table");
  await page.getByRole("button", { name: "save view" }).click();
  await page.goto("/tasks");
  const viewSelect = page.getByLabel("views");
  await expect(viewSelect.locator("option", { hasText: "grouped table" })).toHaveCount(1);
  await viewSelect.selectOption({ label: "grouped table" });
  await expect(page).toHaveURL(/view=table/u);
  await expect(page).toHaveURL(/group=priority/u);
  await expect(table.locator("section h2")).toHaveCount(2);
});
