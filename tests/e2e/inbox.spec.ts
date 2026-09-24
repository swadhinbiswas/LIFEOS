import { expect, test } from "@playwright/test";

import { column, createVerifiedUser, serverCard, signIn, uniqueEmail } from "./helpers";

/**
 * Quick capture and triage (spec §4.3 grammar + §6.2 inbox): the box parses the natural
 * language into due date, label and priority, and triage moves the card through the same
 * service path the board uses.
 */
test("inbox: quick capture parses the grammar, triage moves the card", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("inbox");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/inbox");

  const input = page.getByLabel("capture a task");
  await input.fill("buy milk tomorrow 5pm #home !2");

  // The preview is the server parser's own output.
  await expect(page.getByText("adds:")).toBeVisible();
  await expect(page.getByText("#home")).toBeVisible();
  await expect(page.getByText("uncertain:")).toHaveCount(0); // 5pm is a certain time

  await input.press("Enter");

  const captured = page.locator('[data-slot="inbox-card"]', { hasText: "buy milk" });
  await expect(captured).toBeVisible();
  await expect(captured).toContainText("p2");

  // Triage to Today removes it from the inbox…
  await captured.getByRole("button", { name: "move buy milk to Today" }).click();
  await expect(page.locator('[data-slot="inbox-card"]', { hasText: "buy milk" })).toHaveCount(0);

  // …and it really moved: the Tasks board's Today column holds it.
  await page.goto("/tasks");
  await expect(serverCard(page, "Today", "buy milk")).toBeVisible();
  await expect(
    column(page, "Inbox").locator('[data-slot="card"]', { hasText: "buy milk" }),
  ).toHaveCount(0);
});
