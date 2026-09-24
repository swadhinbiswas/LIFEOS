import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * Phase 3 acceptance anchor: a job can be added from the pipeline in well under 10 seconds, and
 * the job's page records interview rounds (spec §6.3).
 */
test("career: add a job in under 10s, then log an interview round", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("career");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/career/jobs");

  const started = Date.now();
  await page.getByLabel("job title").fill("Senior Backend Engineer");
  await page.getByLabel("company").fill("Acme");
  await page.getByRole("button", { name: "add job" }).click();
  await page.waitForURL(/\/career\/jobs\/[^/]+$/u);
  expect(Date.now() - started).toBeLessThan(10_000);

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Senior Backend Engineer");
  await expect(page.getByText("Acme")).toBeVisible();

  await page.getByLabel("interview round").selectOption("tech");
  await page.getByLabel("interview feedback").fill("system design on queues");
  await page.getByRole("button", { name: "log round" }).click();
  await expect(page.locator('[data-slot="interview-row"]')).toHaveCount(1);

  await page.reload();
  await expect(page.locator('[data-slot="interview-row"]')).toHaveCount(1);
});
