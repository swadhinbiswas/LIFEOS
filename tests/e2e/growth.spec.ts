import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * Growth surfaces work for any user without the sample import: their own project, skill and
 * brag-doc entry persist, and their rows are never labelled `sample` (spec §12).
 */
test("portfolio: add a project, a skill and a win", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("growth");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/career/portfolio");

  await page.getByLabel("project name").fill("My own project");
  await page.getByLabel("project url").fill("https://example.test/mine");
  await page.getByLabel("project language").fill("Rust");
  await page.getByRole("button", { name: "add project" }).click();

  const project = page.locator('[data-slot="project-row"]', { hasText: "My own project" });
  await expect(project).toBeVisible();
  await expect(project).toContainText("Rust");
  await expect(project).not.toContainText("sample");

  await page.getByLabel("skill name").fill("Kubernetes");
  await page.getByLabel("skill level").fill("4");
  await page.getByRole("button", { name: "add skill" }).click();
  const skill = page.locator('[data-slot="skill-row"]', { hasText: "Kubernetes" });
  await expect(skill).toBeVisible();
  await expect(skill).toContainText("★★★★");

  await page.getByLabel("achievement title").fill("Cut p95 latency");
  await page.getByLabel("achievement impact").fill("40% faster checkout");
  await page.getByRole("button", { name: "add win" }).click();
  await expect(
    page.locator('[data-slot="achievement-row"]', { hasText: "Cut p95 latency" }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.locator('[data-slot="project-row"]', { hasText: "My own project" }),
  ).toBeVisible();
  await expect(
    page.locator('[data-slot="achievement-row"]', { hasText: "Cut p95 latency" }),
  ).toBeVisible();
});
