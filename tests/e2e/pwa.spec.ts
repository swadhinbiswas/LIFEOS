import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * PWA (MVP #29, ADR-055): the manifest makes the app installable, and a visited page is served
 * from the service worker's cache when the network is gone.
 */
test("pwa: a manifest is served and a visited page loads offline from cache", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  const email = uniqueEmail("pwa");

  await createVerifiedUser(page, email);
  await signIn(page, email);

  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "About", level: 1 })).toBeVisible();

  // Installable: a manifest with a name, standalone display and at least one icon.
  const manifest = await page.evaluate(async () => {
    const response = await fetch("/manifest.webmanifest");
    return response.ok ? await response.json() : null;
  });
  expect(manifest?.name).toContain("LifeOS");
  expect(manifest?.display).toBe("standalone");
  expect((manifest?.icons ?? []).length).toBeGreaterThan(0);

  // Let the service worker take control, then cache this navigation.
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
    timeout: 20_000,
  });
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "About", level: 1 })).toBeVisible();
  await page.waitForTimeout(500);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "About", level: 1 })).toBeVisible();
  await context.setOffline(false);
});
