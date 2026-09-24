import { expect, test } from "@playwright/test";

import { createVerifiedUser, serverCard, signIn, uniqueEmail } from "./helpers";

/**
 * The §4.3 keyboard model end to end: capture with `n`, move focus with `j`, complete with
 * Space, switch views with `1`/`2`, navigate with `g`-then-letter and toggle the theme with
 * `t` — no pointer involved after sign-in.
 */
test("keyboard only: new item, focus, complete, views, g-nav, theme", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("keys");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/tasks");

  // `n` focuses the quick-add in the first column; type and submit without touching the mouse.
  await page.keyboard.press("n");
  await expect(page.getByLabel("add a card to Inbox")).toBeFocused();
  await page.keyboard.type("keyboard card");
  await page.keyboard.press("Enter");
  await expect(serverCard(page, "Inbox", "keyboard card")).toBeVisible();

  // Leave the input so the list keys apply, focus the card with `j`, complete it with Space.
  await page.getByLabel("add a card to Inbox").blur();
  await page.keyboard.press("j");
  await expect(page.locator('[data-slot="card"][data-focused="true"]')).toHaveCount(1);
  await page.keyboard.press("Space");
  await expect(serverCard(page, "Done", "keyboard card")).toBeVisible();

  // `1` shows the table view, `2` returns to kanban.
  await page.keyboard.press("1");
  await expect(page).toHaveURL(/view=table/u);
  await page.keyboard.press("2");
  await expect(page).not.toHaveURL(/view=table/u);

  // `g` then `i` navigates to the inbox.
  await page.keyboard.press("g");
  await page.keyboard.press("i");
  await page.waitForURL("**/inbox");
  await expect(page.getByRole("heading", { name: "Inbox", level: 1 })).toBeVisible();

  // `t` toggles the colour mode.
  const html = page.locator("html");
  const before = await html.getAttribute("data-color-mode");
  await page.keyboard.press("t");
  await expect(html).not.toHaveAttribute("data-color-mode", before ?? "");
});

/**
 * `?` must document exactly the bindings that exist — the cheat-sheet is generated from
 * `config/shortcuts.ts`, so this guards against it drifting back into advertising dead keys.
 */
test("help cheat-sheet lists the active bindings", async ({ page }) => {
  const email = uniqueEmail("help");
  await createVerifiedUser(page, email);
  await signIn(page, email);

  await page.keyboard.press("?");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("move focus");
  await expect(dialog).toContainText("toggle theme");
  // Views that do not exist yet must not be advertised.
  await expect(dialog).not.toContainText("timeline");
  await expect(dialog).not.toContainText("calendar");
});
