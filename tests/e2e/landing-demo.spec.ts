import { expect, test } from "@playwright/test";

/**
 * Public landing and demo (spec §14 Phase 8, ADR-086): a fresh visitor sees the landing page and can
 * look around the seeded demo without an account. The demo is reachable by URL but is no longer
 * advertised with a hero button.
 */
test("landing: a visitor sees the hero and the sign-up entry point", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "create your workspace" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "read the docs" }).first()).toBeVisible();
});

test("demo: sample data is visible without an account", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByText(/sample data from the research-based seed/i)).toBeVisible();
  // Seeded sample content is rendered read-only, with project rows labelled `sample`.
  await expect(page.getByText("MLOps Engineer").first()).toBeVisible();
  await expect(page.getByText("sample", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "create an account" })).toBeVisible();
});
