import { expect, test } from "@playwright/test";

import { createVerifiedUser, serverCard, signIn, uniqueEmail } from "./helpers";

/**
 * Calendar (spec §6.9 / #24, ADR-052): a dated task shows in the month grid and survives the
 * switch to the week and agenda views.
 */
test("calendar: a dated task shows across month, week and agenda", async ({ page }) => {
  test.setTimeout(120_000);
  const email = uniqueEmail("calendar");

  await createVerifiedUser(page, email);
  await signIn(page, email);

  await page.goto("/tasks");
  const title = "ship the calendar";
  const adder = page.getByLabel("add a card to Inbox");
  await adder.click();
  await adder.fill(title);
  await adder.press("Enter");

  const card = serverCard(page, "Inbox", title);
  await expect(card).toBeVisible();
  const cardId = await card.getAttribute("data-card-id");
  expect(cardId).toBeTruthy();

  const today = new Date().toISOString().slice(0, 10);
  await page.goto(`/tasks?card=${cardId}`);
  await page.getByRole("dialog").getByLabel("due").fill(today);
  await page.waitForLoadState("networkidle");

  await page.goto("/calendar");
  await expect(page.locator('[data-slot="calendar-label"]')).toBeVisible();
  await expect(page.locator('[data-slot="calendar-event"]', { hasText: title })).toBeVisible();

  await page.getByRole("link", { name: "week" }).click();
  await expect(page.locator('[data-slot="calendar-event"]', { hasText: title })).toBeVisible();

  await page.getByRole("link", { name: "agenda" }).click();
  await expect(page.locator('[data-slot="calendar-event"]', { hasText: title })).toBeVisible();
});
