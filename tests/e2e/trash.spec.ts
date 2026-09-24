import { expect, test } from "@playwright/test";

import { createVerifiedUser, serverCard, signIn, uniqueEmail } from "./helpers";

/**
 * Cross-module trash (spec §6.9, ADR-048): a deleted card and a deleted note both surface in
 * `/trash`, and restoring them puts them back — the note searchable again, the card on its board.
 */
test("trash: a deleted card and note are listed and restored", async ({ page }) => {
  test.setTimeout(120_000);
  const email = uniqueEmail("trash");

  await createVerifiedUser(page, email);
  await signIn(page, email);

  // A card, deleted through the sheet.
  await page.goto("/tasks");
  const cardTitle = "card to delete";
  const adder = page.getByLabel("add a card to Inbox");
  await adder.click();
  await adder.fill(cardTitle);
  await adder.press("Enter");
  const card = serverCard(page, "Inbox", cardTitle);
  await expect(card).toBeVisible();
  const cardId = await card.getAttribute("data-card-id");
  expect(cardId).toBeTruthy();

  await page.goto(`/tasks?card=${cardId}`);
  await page.getByRole("dialog").getByRole("button", { name: "delete" }).click();
  await page.waitForLoadState("networkidle");

  // A note, deleted from its editor.
  await page.goto("/notes");
  await page.getByRole("button", { name: "new note" }).click();
  await page.waitForURL(/\/notes\/[^/]+$/u);
  await page.getByLabel("note title").fill("note to delete");
  await page.getByRole("button", { name: "save" }).click();
  await expect(page.locator('[data-slot="note-status"]')).toHaveText("saved");
  await page.locator('[data-slot="note-editor"]').getByRole("button", { name: "delete" }).click();
  await page.waitForURL("**/notes");

  // The shared trash lists both kinds.
  await page.goto("/trash");
  const cardRow = page.locator('[data-slot="trash-row"][data-kind="card"]', {
    hasText: cardTitle,
  });
  const noteRow = page.locator('[data-slot="trash-row"][data-kind="note"]', {
    hasText: "note to delete",
  });
  await expect(cardRow).toBeVisible();
  await expect(noteRow).toBeVisible();

  await noteRow.getByRole("button", { name: "restore note to delete" }).click();
  await expect(
    page.locator('[data-slot="trash-row"][data-kind="note"]', { hasText: "note to delete" }),
  ).toHaveCount(0);

  await cardRow.getByRole("button", { name: `restore ${cardTitle}` }).click();
  await expect(
    page.locator('[data-slot="trash-row"][data-kind="card"]', { hasText: cardTitle }),
  ).toHaveCount(0);

  // Restored work is actually back where it belongs.
  await page.goto("/tasks");
  await expect(serverCard(page, "Inbox", cardTitle)).toBeVisible();
  await page.goto("/notes");
  await expect(page.locator('[data-slot="note-row"]', { hasText: "note to delete" })).toBeVisible();
});
