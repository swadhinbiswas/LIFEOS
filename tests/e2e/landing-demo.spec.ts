import { expect, test } from "@playwright/test";

/**
 * Public landing and demo (spec §14 Phase 8, ADR-086): a fresh visitor sees the landing page and can
 * look around the seeded demo without an account.
 */
test("landing: a visitor sees the hero and the demo entry points", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "try the demo" })).toBeVisible();
  await expect(page.getByRole("link", { name: "sign in" })).toBeVisible();
});

test("demo: sample data is visible without an account", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByText(/sample data from the research-based seed/i)).toBeVisible();
  // Seeded sample content is rendered read-only, with project rows labelled `sample`.
  await expect(page.getByText("MLOps Engineer").first()).toBeVisible();
  await expect(page.getByText("sample", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "create an account" })).toBeVisible();
});
