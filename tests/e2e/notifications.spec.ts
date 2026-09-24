import { expect, test } from "@playwright/test";

import { createVerifiedUser, serverCard, signIn, uniqueEmail } from "./helpers";

/**
 * Notification centre (spec §6.9, ADR-047): an overdue task materialises a nudge on read, the
 * header bell counts it without visiting the centre, and marking it read is a persisted write.
 */
test("notifications: an overdue task nudges, the bell counts it, and read sticks", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("notif");

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

  // Give it a past due date through the real sheet, so the sweep has something to report.
  const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.goto(`/tasks?card=${cardId}`);
  await page.getByRole("dialog").getByLabel("due").fill(past);
  await page.waitForLoadState("networkidle");

  // The shell sweeps on read, so the bell counts the nudge without visiting the centre.
  await page.goto("/tasks");
  const bell = page.locator('[data-slot="notification-bell"]');
  await expect(bell).toHaveAttribute("aria-label", "notifications, 1 unread");
  await expect(page.locator('[data-slot="notification-count"]')).toHaveText("1");

  await bell.click();
  await page.waitForURL("**/notifications");
  const row = page.locator('[data-slot="notification-row"]');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("overdue");
  await expect(row).toHaveAttribute("data-read", "false");

  await row.getByRole("button", { name: /mark .* read/u }).click();
  await expect(row).toHaveAttribute("data-read", "true");
  await expect(page.locator('[data-slot="notification-count"]')).toHaveCount(0);

  // Read state is a write, not client state: it survives a reload.
  await page.reload();
  await expect(page.locator('[data-slot="notification-row"]')).toHaveAttribute("data-read", "true");
  await expect(page.locator('[data-slot="notification-count"]')).toHaveCount(0);
});
