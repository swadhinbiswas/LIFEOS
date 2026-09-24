import { expect, test } from "@playwright/test";

import { createVerifiedUser, serverCard, signIn, uniqueEmail } from "./helpers";

/**
 * Offline quick capture (MVP #29, ADR-051): a capture made with the browser offline is queued,
 * shown in the shell, and replayed through the normal capture action when the connection returns.
 */
test("offline capture: a queued task syncs after reconnect", async ({ page, context }) => {
  test.setTimeout(120_000);
  const email = uniqueEmail("offline");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/inbox");

  await context.setOffline(true);

  const title = "buy milk offline";
  const adder = page.getByLabel("capture a task");
  await adder.click();
  await adder.fill(title);
  await adder.press("Enter");

  const status = page.locator('[data-slot="offline-queue-status"]');
  await expect(status).toBeVisible();
  await expect(page.locator('[data-slot="offline-queue-count"]')).toContainText("1 waiting");

  // It is queued, not created: the inbox triage list never saw it.
  await expect(page.locator('[data-slot="inbox-card"]', { hasText: title })).toHaveCount(0);

  await context.setOffline(false);
  await expect(status).toHaveCount(0, { timeout: 15_000 });

  // And once synced it is a real card through the same service the online path uses.
  await page.goto("/tasks");
  await expect(serverCard(page, "Inbox", title)).toBeVisible();
});
