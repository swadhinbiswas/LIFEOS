import { expect, test, type Page } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * The phone layout (ADR-103). Before the drawer, a 390 px viewport rendered the 16rem sidebar as
 * a column and left the content about 100 px wide — unreadable, and invisible to an overflow check
 * because the shell clips with `overflow-x-hidden`. These tests assert the *content column* gets the
 * viewport, which is the thing that was actually broken.
 */
test.use({ viewport: { width: 390, height: 844 } });

const PHONE = { width: 390, height: 844 };

/** A verified, onboarded account — the sign-up dance every test needs on a fresh database. */
async function newAccount(page: Page, prefix: string) {
  const email = uniqueEmail(prefix);
  await createVerifiedUser(page, email);
  await signIn(page, email);
}

test("mobile: the sidebar is a drawer, not a column", async ({ page }) => {
  test.setTimeout(90_000);
  await newAccount(page, "mobile");

  // The bar is off-canvas: it must not eat the content column, and it must be out of the tab order
  // and the accessibility tree while it is closed.
  const sidebar = page.locator(".app-sidebar");
  const closed = await sidebar.boundingBox();
  expect((closed?.x ?? 0) + (closed?.width ?? 0)).toBeLessThanOrEqual(1);
  await expect(sidebar).toHaveJSProperty("inert", true);

  const content = await page.locator("main > div").boundingBox();
  expect(content?.width ?? 0).toBeGreaterThan(PHONE.width * 0.85);

  // The header button opens it, with the drawer announced as expanded. The bar animates in over
  // 150 ms, so the geometry is polled rather than read once.
  const toggle = page.locator('[data-slot="sidebar-toggle"]');
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect
    .poll(async () => (await sidebar.boundingBox())?.x ?? -999)
    .toBeGreaterThanOrEqual(-1);

  // Labels are readable inside the drawer, even if the saved mode is the icon rail.
  await expect(sidebar.getByRole("link", { name: "Tasks" })).toBeVisible();

  // Navigating closes it, rather than covering the page that was asked for.
  await sidebar.getByRole("link", { name: "Tasks" }).click();
  await page.waitForURL("**/tasks");
  await expect
    .poll(async () => {
      const box = await sidebar.boundingBox();
      return (box?.x ?? 0) + (box?.width ?? 0);
    })
    .toBeLessThanOrEqual(1);
});

test("mobile: a chart panel is readable rather than a sliver", async ({ page }) => {
  test.setTimeout(90_000);
  await newAccount(page, "mobile-dash");

  await page.goto("/dashboard?variant=overview");
  const panel = page.locator('[data-slot="panel"]').first();
  const box = await panel.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(PHONE.width * 0.8);
  // A panel title that truncates to an ellipsis is the symptom of the old starved column.
  await expect(panel.locator("h2").first()).toBeVisible();
});
