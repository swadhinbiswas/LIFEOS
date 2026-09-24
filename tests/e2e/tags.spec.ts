import { expect, test } from "@playwright/test";

import { createVerifiedUser, serverCard, signIn, uniqueEmail } from "./helpers";

/**
 * Tags on notes (spec §6.9, ADR-049): a note saves with tags, the library filters by one, and the
 * chip on the row is the same tag the filter links to.
 */
test("tags: a note saves with tags and the library filters by one", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("tags");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/notes");

  await page.getByRole("button", { name: "new note" }).click();
  await page.waitForURL(/\/notes\/[^/]+$/u);
  await page.getByLabel("note title").fill("Tagged note");
  await page.getByLabel("note tags").fill("alpha, beta");
  await page.getByRole("button", { name: "save" }).click();
  await expect(page.locator('[data-slot="note-status"]')).toHaveText("saved");

  await page.goto("/notes?tag=alpha");
  await expect(page.locator('[data-slot="note-row"]', { hasText: "Tagged note" })).toBeVisible();
  await expect(page.locator('[data-slot="note-tag"]', { hasText: "#alpha" })).toBeVisible();

  await page.goto("/notes?tag=missing");
  await expect(page.locator('[data-slot="note-row"]')).toHaveCount(0);
});

/**
 * Linking a card to a goal from the card sheet (spec §6.9, ADR-049): the link is written through
 * the goals service, so the goal page's derived progress counts it.
 */
test("goal links: a card links to a goal from the sheet and feeds its progress", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("goallink");

  await createVerifiedUser(page, email);
  await signIn(page, email);

  await page.goto("/goals");
  await page.getByLabel("objective").fill("Ship LifeOS properly");
  await page.getByRole("button", { name: "add objective" }).click();
  await expect(page.getByRole("heading", { name: "Ship LifeOS properly" })).toBeVisible();

  await page.goto("/tasks");
  const title = "goal-linked card";
  const adder = page.getByLabel("add a card to Inbox");
  await adder.click();
  await adder.fill(title);
  await adder.press("Enter");
  const card = serverCard(page, "Inbox", title);
  await expect(card).toBeVisible();
  const cardId = await card.getAttribute("data-card-id");
  expect(cardId).toBeTruthy();

  await page.goto(`/tasks?card=${cardId}`);
  const sheet = page.getByRole("dialog");
  await sheet
    .getByLabel("link this card to a goal")
    .selectOption({ label: "Ship LifeOS properly" });
  await sheet.getByRole("button", { name: "link", exact: true }).click();
  await expect(
    page.locator('[data-slot="card-goal-link"]', { hasText: "Ship LifeOS properly" }),
  ).toBeVisible();

  // The goal's derived progress reads the same link.
  await page.goto("/goals");
  await expect(page.getByText("linked 0/1")).toBeVisible();

  // Unlinking removes it again.
  await page.goto(`/tasks?card=${cardId}`);
  await page.getByRole("button", { name: "unlink Ship LifeOS properly" }).click();
  await expect(
    page.locator('[data-slot="card-goal-link"]', { hasText: "Ship LifeOS properly" }),
  ).toHaveCount(0);
});
