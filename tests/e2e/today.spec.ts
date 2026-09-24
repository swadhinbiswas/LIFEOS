import { expect, test } from "@playwright/test";

import { createVerifiedUser, serverCard, signIn, uniqueEmail } from "./helpers";

/**
 * Plan my day (spec §6.2): the brief counts real cards, the top three lead with priorities,
 * and `c` carries overdue work into Today — then it survives a reload.
 */
test("plan my day: brief counts, top three, carry-over on c", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("today");

  await createVerifiedUser(page, email);
  await signIn(page, email);

  await page.goto("/inbox");
  const capture = page.getByLabel("capture a task");
  await capture.fill("pay rent yesterday !0");
  await capture.press("Enter");
  await expect(page.locator('[data-slot="inbox-card"]', { hasText: "pay rent" })).toBeVisible();

  await page.goto("/tasks");
  const panel = page.locator('[data-slot="panel"]', { hasText: "Plan my day" });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("carry over overdue (1)");
  await expect(panel).toContainText("pay rent"); // a P0 leads the top three

  // `c` carries the overdue card into Today.
  await page.keyboard.press("c");
  await expect(serverCard(page, "Today", "pay rent")).toBeVisible();
  await page.waitForLoadState("networkidle");

  await page.reload();
  await expect(serverCard(page, "Today", "pay rent")).toBeVisible();
  await expect(page.locator('[data-slot="panel"]', { hasText: "Plan my day" })).toContainText(
    "carry over overdue (0)",
  );
});
