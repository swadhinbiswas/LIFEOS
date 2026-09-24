import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

interface AxeViolation {
  id: string;
  impact?: string | null;
  help: string;
  nodes: Array<{ target: string[] }>;
}

declare global {
  interface Window {
    axe: { run: (context?: unknown, options?: unknown) => Promise<{ violations: AxeViolation[] }> };
  }
}

async function scan(page: Page): Promise<AxeViolation[]> {
  // Reset interaction state first: a click leaves the pointer hovering the control, and
  // Tailwind v4's hover opacity uses `color-mix(in oklab, …)`, whose parsed colours axe
  // reports as false-positive contrast failures. Scan the resting state.
  await page.mouse.move(0, 0);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.addScriptTag({ content: axeSource });
  const { violations } = await page.evaluate(() => window.axe.run());
  return violations;
}

const describe = (violations: AxeViolation[]): string =>
  violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact ?? "n/a"}): ${violation.nodes
          .map((node) => node.target.join(" "))
          .join(", ")}`,
    )
    .join(" | ");

const PRESETS = [
  { id: "midnight", label: "Midnight" },
  { id: "mocha", label: "Mocha" },
  { id: "gruvbox", label: "Gruvbox" },
  { id: "phosphor", label: "Phosphor" },
  { id: "amber", label: "Amber" },
  { id: "paper", label: "Paper" },
] as const;

const AUTH_ROUTES = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];
const SHELL_ROUTES = [
  "/settings",
  "/settings/appearance",
  "/tasks",
  "/dashboard",
  "/reviews",
  "/habits",
  "/goals",
  "/notes",
  "/focus",
  "/finance",
  "/health",
  "/learning",
  "/inbox",
  "/boards",
  "/career/jobs",
  "/career/analytics",
  "/career/portfolio",
  "/career/interview-prep",
];

/**
 * Phase 1 axe gate (spec §13 / ADR-029): every shell surface passes axe-core, and the two
 * signed-in routes are re-scanned under all six presets — a palette that fails contrast or
 * an attribute combination that hides a label would surface here.
 */
test("axe: auth routes pass", async ({ page }) => {
  test.setTimeout(180_000);
  for (const route of AUTH_ROUTES) {
    await page.goto(route);
    const violations = await scan(page);
    expect(violations, `${route}: ${describe(violations)}`).toEqual([]);
  }
});

test("axe: signed-in shell passes in every preset", async ({ page }) => {
  test.setTimeout(300_000);
  const email = uniqueEmail("axe");

  await createVerifiedUser(page, email);
  await signIn(page, email);

  for (const preset of PRESETS) {
    await page.goto("/settings/appearance");
    await page.getByRole("radio", { name: preset.label }).click();
    await page.waitForTimeout(400);

    for (const route of SHELL_ROUTES) {
      await page.goto(route);
      const violations = await scan(page);
      expect(violations, `${route} @ ${preset.id}: ${describe(violations)}`).toEqual([]);
    }
  }
});

/**
 * The job detail route is dynamic, so it needs a job to exist before it can be scanned. Built
 * through the real UI rather than a fixture so the scan covers the route as users reach it.
 */
test("axe: the job detail route passes", async ({ page }) => {
  test.setTimeout(120_000);
  const email = uniqueEmail("axe-job");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/career/jobs");
  await page.getByLabel("job title").fill("Axe check job");
  await page.getByLabel("company").fill("Acme");
  await page.getByRole("button", { name: "add job" }).click();
  await page.waitForURL(/\/career\/jobs\/[^/]+$/u);

  const violations = await scan(page);
  expect(violations, `job detail: ${describe(violations)}`).toEqual([]);
});
