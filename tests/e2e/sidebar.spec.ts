import { expect, test, type Page } from "@playwright/test";

import { createVerifiedUser, serverCard, signIn, uniqueEmail } from "./helpers";

/**
 * The sidebar footer (ADR-117, ADR-130).
 *
 * A screenshot showed `searchCtrlK` and `notifications2`: those two rows passed `gap-2`,
 * `justify-start` and `ml-auto` to {@link controlGhost}, which declared no `display` — so every one
 * of those flex-only utilities was inert and the label, the key caps and the unread count rendered
 * flush. The same missing display pushed the search row 62px outside the 48px icon rail, over the
 * fold control beside it.
 *
 * No other check in the gate can see either one: the classes are valid, so the compiler is happy;
 * jsdom has no cascade, so a rendered unit test is happy; and the shell clips with
 * `overflow-x-hidden`, so a scrollbar check is happy. The geometry has to be measured in a browser.
 */

const DESKTOP = { width: 1280, height: 800 };

async function newAccount(page: Page, prefix: string) {
  const email = uniqueEmail(prefix);
  await createVerifiedUser(page, email);
  await signIn(page, email);
}

/** An overdue task, so the shell's sweep gives the bell a count to draw. */
async function overdueTask(page: Page) {
  await page.goto("/tasks");
  const adder = page.getByLabel("add a card to Inbox");
  await adder.click();
  await adder.fill("renew the domain");
  await adder.press("Enter");

  const cardId = await serverCard(page, "Inbox", "renew the domain").getAttribute("data-card-id");
  expect(cardId).toBeTruthy();
  const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.goto(`/tasks?card=${cardId}`);
  await page.getByRole("dialog").getByLabel("due").fill(past);
  await page.waitForLoadState("networkidle");
  await page.goto("/tasks");
  await expect(page.locator('[data-slot="notification-count"]')).toHaveText("1");
}

type Geometry = {
  /** Label → first key cap, in px. Negative means the two overlap. */
  labelToKbd: number;
  /** First key cap → second, in px. */
  kbdToKbd: number;
  /** Bell label → unread count, in px, or `null` when nothing is unread. */
  labelToCount: number | null;
  /** How far the widest footer control's right edge sits past the rail's, in px. */
  overflow: number;
};

async function geometry(page: Page): Promise<Geometry> {
  return page.evaluate(() => {
    const aside = document.querySelector("aside.app-sidebar")!.getBoundingClientRect();
    const search = document.querySelector('[data-slot="sidebar-search"]')!;
    const label = search.querySelector(".nav-label")!;
    const kbds = [...search.querySelectorAll<HTMLElement>('[data-slot="kbd"]')];
    const bell = document.querySelector('[data-slot="notification-bell"]')!;
    const count = bell.querySelector('[data-slot="notification-count"]');
    const r = (el: Element) => el.getBoundingClientRect();
    return {
      labelToKbd: Math.round(r(kbds[0]!).left - r(label).right),
      kbdToKbd: kbds.length > 1 ? Math.round(r(kbds[1]!).left - r(kbds[0]!).right) : 0,
      labelToCount: count
        ? Math.round(r(count).left - r(bell.querySelector(".nav-label")!).right)
        : null,
      overflow: Math.round(Math.max(r(search).right, r(bell).right) - aside.right),
    };
  });
}

test("sidebar: the footer spaces its label from the key caps and the count", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize(DESKTOP);
  await newAccount(page, "sidebar");
  await overdueTask(page);

  const { labelToKbd, kbdToKbd, labelToCount, overflow } = await geometry(page);
  expect(labelToKbd, "the label is flush against the key caps").toBeGreaterThanOrEqual(4);
  expect(kbdToKbd, "the two key caps are flush").toBeGreaterThanOrEqual(4);
  expect(labelToCount, "the count is flush against the label").toBeGreaterThanOrEqual(4);
  expect(overflow, "a footer control spills out of the rail").toBeLessThanOrEqual(0);
});

test("sidebar: the icon rail holds its controls and keeps the count as a dot", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize(DESKTOP);
  await newAccount(page, "sidebar-rail");
  await overdueTask(page);

  const toggle = page.locator('[data-slot="sidebar-toggle"]');
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-sidebar-mode", "icon");

  const rail = await page.locator("aside.app-sidebar").boundingBox();
  expect(rail?.width ?? 0).toBeLessThan(60);

  // A labelled row's affordances have no room in a rail: the caps leave with the labels, and the
  // count is drawn as the dot it can be. The count is not lost — the bell's label still carries it.
  await expect(page.locator('[data-slot="sidebar-search"] .nav-label')).toBeHidden();
  await expect(page.locator('[data-slot="sidebar-search"] [data-slot="kbd"]').first()).toBeHidden();
  await expect(page.locator('[data-slot="notification-bell"]')).toHaveAttribute(
    "aria-label",
    "notifications, 1 unread",
  );
  const dot = await page.locator('[data-slot="notification-count"]').boundingBox();
  expect(dot?.width ?? 99).toBeLessThanOrEqual(8);

  const { overflow } = await geometry(page);
  expect(overflow, "a control spills out of the rail").toBeLessThanOrEqual(0);

  // The two rows stack, so the search sits below the fold control rather than beside it.
  const fold = await toggle.boundingBox();
  const search = await page.locator('[data-slot="sidebar-search"]').boundingBox();
  expect(search?.y ?? 0).toBeGreaterThan(fold?.y ?? 0);

  // The fold control is still reachable — the spill used to cover it, so the second click did
  // nothing and the mode never advanced past `icon`. The cycle is expanded → icon → full.
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-sidebar-mode", "full");
});
