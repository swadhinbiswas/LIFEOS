import { expect, test } from "@playwright/test";

import { PASSWORD, createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * Phase 8 acceptance (spec §14): a new user reaches a populated dashboard in ≤ 60 s, the template
 * gallery lists the board templates and starter profiles, and the in-app docs render the repo files.
 */
test("onboarding: a new account reaches a populated dashboard in under 60s", async ({ page }) => {
  test.setTimeout(150_000);
  const email = uniqueEmail("onboard");

  await createVerifiedUser(page, email);
  const started = Date.now();

  await signIn(page, email, PASSWORD, { onboard: false });
  await page.goto("/dashboard");
  await page.waitForURL("**/onboarding");

  await page.getByRole("button", { name: "next" }).click();
  await page.getByRole("radio", { name: /developer/i }).check();
  await page.getByRole("button", { name: "next" }).click();
  await page.getByRole("radio", { name: /daily kanban/i }).check();
  await page.getByRole("button", { name: "finish setup" }).click();
  await page.waitForURL("**/dashboard");

  expect(Date.now() - started).toBeLessThan(60_000);

  // The account is populated with the selected developer profile's content.
  await page.goto("/tasks");
  await expect(page.getByText("Reply to the Northwind recruiter").first()).toBeVisible();
});

test("templates: the gallery lists board templates and starter profiles", async ({ page }) => {
  await page.goto("/templates");
  await expect(page.getByRole("heading", { level: 1, name: "Templates" })).toBeVisible();
  await expect(page.getByText("Job Pipeline", { exact: true })).toBeVisible();
  await expect(page.getByText("Freelancer", { exact: true })).toBeVisible();
});

test("docs: the index renders and a document opens", async ({ page }) => {
  const email = uniqueEmail("docs");
  await createVerifiedUser(page, email);
  await signIn(page, email);

  await page.goto("/docs");
  await expect(page.getByRole("heading", { level: 1, name: "Docs" })).toBeVisible();
  await expect(
    page.locator('[data-slot="docs-list"]').getByRole("link", { name: "OpenAPI reference" }),
  ).toBeVisible();

  await page.goto("/docs/readme");
  await expect(page.getByRole("heading", { level: 1, name: "README" })).toBeVisible();
  // The README exists in the repo, so it renders as preformatted text.
  await expect(page.locator('[data-slot="doc-content"]')).toBeVisible();
});
