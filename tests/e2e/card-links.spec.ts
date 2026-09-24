import { expect, test } from "@playwright/test";

import { createVerifiedUser, serverCard, signIn, uniqueEmail } from "./helpers";

/**
 * Card↔card links (spec §6.9, ADR-056): the sheet links the open card to another card, shows the
 * relation, and unlinking removes it.
 */
test("card links: link two cards from the sheet and unlink them", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("links");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/tasks");

  const adder = page.getByLabel("add a card to Inbox");
  for (const title of ["alpha card", "beta card"]) {
    await adder.click();
    await adder.fill(title);
    await adder.press("Enter");
  }
  await expect(serverCard(page, "Inbox", "alpha card")).toBeVisible();
  await expect(serverCard(page, "Inbox", "beta card")).toBeVisible();
  await adder.blur();

  const alphaId = await serverCard(page, "Inbox", "alpha card").getAttribute("data-card-id");
  expect(alphaId).toBeTruthy();

  await page.goto(`/tasks?card=${alphaId}`);
  const sheet = page.getByRole("dialog");
  const links = sheet.locator('[data-slot="card-links"]');

  await links.getByLabel("link to card").selectOption({ label: "beta card" });
  await links.getByRole("button", { name: "link", exact: true }).click();

  const linked = links.locator('[data-slot="card-link"]', { hasText: "beta card" });
  await expect(linked).toBeVisible();

  await linked.getByRole("button", { name: "unlink beta card" }).click();
  await expect(links.locator('[data-slot="card-link"]', { hasText: "beta card" })).toHaveCount(0);
});
