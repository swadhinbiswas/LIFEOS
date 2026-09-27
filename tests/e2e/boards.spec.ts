import { expect, test, type Page } from "@playwright/test";

import { column, createVerifiedUser, serverCard, signIn, uniqueEmail } from "./helpers";

/**
 * Press a board view key until the URL answers.
 *
 * The key listener attaches when React hydrates, and `goto` resolves before that, so a single
 * `keyboard.press` can land before anything is listening and be lost for good. Polling the press is
 * the deterministic form of "press it once the app is actually awake".
 */
async function pressViewKey(page: Page, key: string, expected: string): Promise<void> {
  await expect
    .poll(async () => {
      await page.keyboard.press(key);
      return page.url();
    })
    .toContain(`view=${expected}`);
}

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
  await page.getByRole("dialog").getByRole("button", { name: "delete", exact: true }).click();
  await expect(serverCard(page, "Inbox", renamed)).toHaveCount(0);
  await page.getByRole("button", { name: "undo", exact: true }).click();
  await expect(serverCard(page, "Inbox", renamed)).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.goto("/tasks");
  await expect(serverCard(page, "Inbox", renamed)).toBeVisible();

  // The Trash panel is the durable route back, and export links are real downloads.
  await page.getByRole("button", { name: /trash \(/u }).click();
  await expect(page.locator('[data-slot="panel"]', { hasText: "Trash" })).toBeVisible();
  const csvHref = await page.getByRole("link", { name: "csv" }).getAttribute("href");
  expect(csvHref).toContain("/export?format=csv");
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
  await expect(table.locator('[data-slot="table-row"][data-card-id]')).toHaveCount(2);
  await expect(page).toHaveURL(/view=table/u);

  // Quick filter: P0–P1 keeps only alpha, and the URL carries it.
  await page.getByRole("button", { name: "P0–P1" }).click();
  await expect(table.locator('[data-slot="table-row"][data-card-id]')).toHaveCount(1);
  await expect(table.locator('[data-slot="table-row"][data-card-id]')).toContainText("alpha task");
  await expect(page).toHaveURL(/filter=p0-p1/u);

  // Clearing the chip brings both rows back.
  await page.getByRole("button", { name: "P0–P1" }).click();
  await expect(table.locator('[data-slot="table-row"][data-card-id]')).toHaveCount(2);

  // Sort by the card column: ascending then descending flips the first row.
  const cardHeader = table.getByRole("button", { name: "card" }).first();
  await cardHeader.click();
  await expect(table.locator('[data-slot="table-row"][data-card-id]').first()).toContainText(
    "alpha task",
  );
  await cardHeader.click();
  await expect(table.locator('[data-slot="table-row"][data-card-id]').first()).toContainText(
    "beta task",
  );

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

/** The grid is the browsing lens over the same cards: a tile each, and a tile opens the same sheet. */
test("grid view: a tile per card, reachable by the keyboard", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("grid");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/tasks");

  const adder = page.getByLabel("add a card to Inbox");
  for (const title of ["grid alpha", "grid beta"]) {
    await adder.click();
    await adder.fill(title);
    await adder.press("Enter");
  }
  await expect(serverCard(page, "Inbox", "grid alpha")).toBeVisible();

  // The `3` key is spec §4.3's grid shortcut. Blur the adder first, because a shortcut typed into
  // an input is deliberately inert.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await pressViewKey(page, "3", "grid");

  const grid = page.locator('[data-slot="board-grid"]');
  await expect(grid.locator('[data-slot="grid-tile"]')).toHaveCount(2);
  await expect(grid).toContainText("grid alpha");

  // A tile is one button, and it opens the card sheet exactly as a kanban card does.
  await expect(grid.locator('[data-slot="grid-tile"]', { hasText: "grid beta" })).toHaveAttribute(
    "aria-label",
    "open grid beta",
  );
  await grid.locator('[data-slot="grid-tile"]', { hasText: "grid beta" }).click();
  await expect(page).toHaveURL(/card=/u);
  await expect(page.getByRole("dialog").getByLabel("title")).toHaveValue("grid beta");

  // The switcher reflects the URL state too, so a shared link loads with the right chip lit.
  await page.goto("/tasks?view=grid");
  await expect(page.getByRole("button", { name: "grid", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

/** The calendar places dated cards by their authored day, and never drops the undated ones. */
test("calendar view: dated cards land on their day and undated cards stay reachable", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("calendar");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/tasks");

  const adder = page.getByLabel("add a card to Inbox");
  for (const title of ["dated milestone", "undated idea"]) {
    await adder.click();
    await adder.fill(title);
    await adder.press("Enter");
  }
  await expect(serverCard(page, "Inbox", "undated idea")).toBeVisible();

  // Due today: inside the current month's grid *and* inside the agenda's forward window, which
  // starts at the anchor rather than at the first of the month.
  const due = new Date().toISOString().slice(0, 10);
  const datedId = await serverCard(page, "Inbox", "dated milestone").getAttribute("data-card-id");
  await page.goto(`/tasks?card=${datedId}`);
  await page.getByRole("dialog").getByLabel("due").fill(due);
  await page.waitForLoadState("networkidle");

  await page.goto("/tasks?view=calendar");
  const calendar = page.locator('[data-slot="board-calendar"]');
  await expect(calendar).toBeVisible();
  await expect(page.getByRole("button", { name: "calendar", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // The dated card sits in its authored cell; the undated one is in the pile, not lost.
  await expect(calendar.locator(`[data-day="${due}"] [data-slot="calendar-card"]`)).toContainText(
    "dated milestone",
  );
  const unscheduled = calendar.locator('[data-slot="calendar-unscheduled"]');
  await expect(unscheduled).toContainText("undated idea");
  await expect(unscheduled).toContainText("no due date");

  // The agenda sub-view lists the same day, and a chip opens the card sheet.
  await calendar.getByRole("button", { name: "agenda", exact: true }).click();
  const agenda = calendar.locator('[data-slot="board-agenda"]');
  await expect(agenda.locator(`[data-day="${due}"]`)).toContainText("dated milestone");
  await agenda.locator('[data-slot="calendar-card"]', { hasText: "dated milestone" }).click();
  await expect(page.getByRole("dialog").getByLabel("title")).toHaveValue("dated milestone");
});

/** The timeline draws a start→due bar, a milestone for one date, and keeps undated cards. */
test("timeline view: a bar spans start to due and opens the card", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("timeline");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/tasks");

  const adder = page.getByLabel("add a card to Inbox");
  for (const title of ["ranged work", "someday work"]) {
    await adder.click();
    await adder.fill(title);
    await adder.press("Enter");
  }
  await expect(serverCard(page, "Inbox", "someday work")).toBeVisible();

  const day = (offset: number) =>
    new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const rangedId = await serverCard(page, "Inbox", "ranged work").getAttribute("data-card-id");
  await page.goto(`/tasks?card=${rangedId}`);
  await page.getByRole("dialog").getByLabel("start").fill(day(-1));
  await page.getByRole("dialog").getByLabel("due").fill(day(2));
  await page.waitForLoadState("networkidle");

  // `5` is spec §4.3's timeline key, which also proves the whole `1`…`5` map is wired.
  await page.goto("/tasks");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await pressViewKey(page, "5", "timeline");

  const timeline = page.locator('[data-slot="board-timeline"]');
  await expect(timeline).toBeVisible();

  // A start and a due date make a bar wider than the milestone mark a single date would draw.
  const bar = timeline.locator(`[data-slot="timeline-bar"][data-card-id="${rangedId}"]`);
  await expect(bar).toHaveAttribute("title", /→/u);
  const box = await bar.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(32);

  // The undated card is not on the axis, and is not hidden either.
  await expect(timeline.locator('[data-slot="timeline-unscheduled"]')).toContainText(
    "someday work",
  );

  await bar.click();
  await expect(page.getByRole("dialog").getByLabel("title")).toHaveValue("ranged work");
});

/** The Trash is the durable route back for anything deleted outside the undo window. */
test("trash: a deleted card restores from the trash panel", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("trash");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/tasks");

  const title = "throw me away";
  const adder = page.getByLabel("add a card to Inbox");
  await adder.click();
  await adder.fill(title);
  await adder.press("Enter");

  const card = serverCard(page, "Inbox", title);
  await expect(card).toBeVisible();
  const cardId = await card.getAttribute("data-card-id");

  await page.goto(`/tasks?card=${cardId}`);
  await page.getByRole("dialog").getByRole("button", { name: "delete", exact: true }).click();
  await expect(serverCard(page, "Inbox", title)).toHaveCount(0);
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: /trash \(/u }).click();
  const trashed = page.locator('[data-slot="trash-card"]', { hasText: title });
  await expect(trashed).toBeVisible();
  await trashed.getByRole("button", { name: `restore ${title}` }).click();

  await expect(page.locator('[data-slot="trash-card"]', { hasText: title })).toHaveCount(0);
  await expect(serverCard(page, "Inbox", title)).toBeVisible();
});

/** Bulk actions (spec §6.1): select with `x`, then move the selection together. */
test("bulk actions: select two cards with x and move them together", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("bulk");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/tasks");

  const adder = page.getByLabel("add a card to Inbox");
  for (const title of ["bulk one", "bulk two"]) {
    await adder.click();
    await adder.fill(title);
    await adder.press("Enter");
  }
  await expect(serverCard(page, "Inbox", "bulk one")).toBeVisible();
  await expect(serverCard(page, "Inbox", "bulk two")).toBeVisible();
  await adder.blur();

  // Keyboard selection: focus the first card, select, focus the next, select.
  await page.keyboard.press("j");
  await page.keyboard.press("x");
  await page.keyboard.press("j");
  await page.keyboard.press("x");

  const bar = page.locator('[data-slot="bulk-bar"]');
  await expect(bar).toContainText("2 selected");

  await bar.getByLabel("move to").selectOption({ label: "Today" });
  await expect(serverCard(page, "Today", "bulk one")).toBeVisible();
  await expect(serverCard(page, "Today", "bulk two")).toBeVisible();
  await expect(bar).toHaveCount(0);
  await page.waitForLoadState("networkidle");

  await page.reload();
  await expect(serverCard(page, "Today", "bulk one")).toBeVisible();
  await expect(serverCard(page, "Today", "bulk two")).toBeVisible();
});

/**
 * Undo/redo (spec §6.1: "last 50 board actions"). Entries are recorded on success, so the test
 * waits for the undo stack to grow (its count is on the control) before pressing the key — no
 * race between the write landing and the keystroke.
 */
test("undo/redo: Ctrl+Z reverses a move and Ctrl+Shift+Z replays it", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("undo");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/tasks");

  const title = "undo me";
  const adder = page.getByLabel("add a card to Inbox");
  await adder.click();
  await adder.fill(title);
  await adder.press("Enter");
  await expect(serverCard(page, "Inbox", title)).toBeVisible();
  await adder.blur();

  const undo = page.locator('[data-slot="undo"]');
  const redo = page.locator('[data-slot="redo"]');
  // The create is action 1; wait for it so the move becomes action 2.
  await expect(undo).toHaveAttribute("data-undo-count", "1");

  await serverCard(page, "Inbox", title)
    .getByRole("button", { name: `move ${title} right` })
    .click();
  await expect(serverCard(page, "Today", title)).toBeVisible();
  await expect(undo).toHaveAttribute("data-undo-count", "2");

  await page.keyboard.press("Control+z");
  await expect(serverCard(page, "Inbox", title)).toBeVisible();
  await expect(redo).toHaveAttribute("data-redo-count", "1");

  await page.keyboard.press("Control+Shift+z");
  await expect(serverCard(page, "Today", title)).toBeVisible();

  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(serverCard(page, "Today", title)).toBeVisible();
});
