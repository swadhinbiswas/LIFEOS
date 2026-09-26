import { expect, test } from "@playwright/test";

import { PASSWORD, createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * Phase 8 acceptance (spec §14): a new user reaches a dashboard in ≤ 60 s, the template gallery
 * lists the board templates, and the in-app docs render the repo files.
 *
 * The dashboard is *empty*, and the test name used to claim otherwise. It read "reaches a populated
 * dashboard" while asserting a seeded developer profile's cards were on the board — so the name
 * described the demo, the body described the product, and the two drifted apart the moment the seed
 * went (ADR-123). A test whose name contradicts its assertions is worse than a failing one: it
 * passes, and it lies about what it checked.
 */
test("onboarding: a new account reaches a dashboard in under 60s, with nothing invented", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const email = uniqueEmail("onboard");

  await createVerifiedUser(page, email);
  const started = Date.now();

  await signIn(page, email, PASSWORD, { onboard: false });
  await page.goto("/dashboard");
  await page.waitForURL("**/onboarding");

  // Two steps: name → starter board (the sample-profile step went with the seed, ADR-123).
  await page.getByRole("button", { name: "next" }).click();
  await page.getByRole("radio", { name: /daily kanban/i }).check();
  await page.getByRole("button", { name: "finish setup" }).click();
  await page.waitForURL("**/dashboard");

  expect(Date.now() - started).toBeLessThan(60_000);

  // The chosen board was created, and nothing was invented: a new account has no cards, because
  // the sample data it used to load is gone.
  await page.goto("/tasks");
  await expect(page.getByText("Reply to the Northwind recruiter")).toHaveCount(0);
  await expect(page.locator('[data-slot="inbox-card"]')).toHaveCount(0);
});

test("templates: the gallery lists the board templates", async ({ page }) => {
  await page.goto("/templates");
  await expect(page.getByRole("heading", { level: 1, name: "Templates" })).toBeVisible();
  await expect(page.getByText("Job Pipeline", { exact: true })).toBeVisible();
  // The starter-profile panel is gone with the seed module (ADR-123); the board templates remain,
  // because choosing one still creates a real board.
  await expect(page.getByText("Freelancer", { exact: true })).toHaveCount(0);
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
