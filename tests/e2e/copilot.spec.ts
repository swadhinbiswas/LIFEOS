import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * AI copilot golden path (spec §8, ADR-076). The E2E run sets `AI_SCRIPTED=true`, so the scripted
 * model answers deterministically and can be asked to emit a tool call with a sentinel — which lets
 * this exercise the real approval flow (propose → approve/reject) with no provider key.
 */
test("copilot: a write is proposed, approved, and a rejected write does not run", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const email = uniqueEmail("copilot");

  await createVerifiedUser(page, email);
  await signIn(page, email);

  await page.goto("/ai");
  const input = page.locator("#copilot-input");
  await expect(input).toBeVisible();

  // A plain message gets the scripted reply.
  await input.fill("hello there");
  await page.getByRole("button", { name: "send" }).click();
  await expect(page.getByText(/answers are canned/i)).toBeVisible();

  // A write is proposed, not performed, until approved.
  await input.fill('[[tool:create_card:{"title":"from the copilot"}]]');
  await page.getByRole("button", { name: "send" }).click();
  const proposed = page.locator('[data-slot="copilot-tool"]').last();
  await expect(proposed).toHaveAttribute("data-state", "approval-requested");
  await page
    .getByRole("button", { name: /approve/ })
    .last()
    .click();
  await expect(proposed).toHaveAttribute("data-state", "output-available");

  // A rejected write never executes.
  await input.fill('[[tool:create_card:{"title":"never created"}]]');
  await page.getByRole("button", { name: "send" }).click();
  const rejected = page.locator('[data-slot="copilot-tool"]').last();
  await expect(rejected).toHaveAttribute("data-state", "approval-requested");
  await page
    .getByRole("button", { name: /reject/ })
    .last()
    .click();
  await expect(rejected).toHaveAttribute("data-state", "output-denied");
});
