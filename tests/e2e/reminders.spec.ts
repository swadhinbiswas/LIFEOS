import { expect, test } from "@playwright/test";

import { createVerifiedUser, serverCard, signIn, uniqueEmail } from "./helpers";

/**
 * Per-card reminders (spec §6.9 / #28, ADR-054): a reminder set in the card sheet is delivered by
 * the notification sweep once its time has passed — no worker involved.
 */
test("reminders: a card reminder becomes a notification", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("remind");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/tasks");

  const title = "renew the domain";
  const adder = page.getByLabel("add a card to Inbox");
  await adder.click();
  await adder.fill(title);
  await adder.press("Enter");
  const card = serverCard(page, "Inbox", title);
  await expect(card).toBeVisible();
  const cardId = await card.getAttribute("data-card-id");
  expect(cardId).toBeTruthy();

  // A minute in the past so the sweep sees it as due immediately.
  const past = new Date(Date.now() - 60_000);
  const pad = (value: number) => String(value).padStart(2, "0");
  const fireAt = `${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}T${pad(past.getHours())}:${pad(past.getMinutes())}`;

  await page.goto(`/tasks?card=${cardId}`);
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("remind me at").fill(fireAt);
  await sheet.getByRole("button", { name: "set", exact: true }).click();
  await expect(sheet.locator('[data-slot="card-reminder-current"]')).toContainText("set for");

  await page.goto("/notifications");
  await expect(
    page.locator('[data-slot="notification-row"]', { hasText: `reminder: ${title}` }),
  ).toBeVisible();
});
