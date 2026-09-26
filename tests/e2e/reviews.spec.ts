import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * Review wizard (spec §6.2/§6.4, ADR-116): answering the guided steps produces a note, the review is
 * listed, and the note is an ordinary note afterwards.
 *
 * The checklist is queried by *role* and clicked, not by label and `check()`ed. `check()` is for a
 * real `<input type="checkbox">`; the TUI checkbox is a `<button role="checkbox">` so that the
 * platform handles the keyboard (ADR-116), and `check()` would simply not find it. Using the role
 * query here also keeps the test honest about what the control actually is.
 */
test("reviews: complete a weekly review into a note", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("reviews");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/reviews");

  // The three steps of §6.2 are present as real checkboxes, and they are unchecked to begin with —
  // a review that arrives pre-ticked would be a review of nothing.
  const clearInbox = page.getByRole("checkbox", { name: "clear the inbox" });
  const reviewBoards = page.getByRole("checkbox", { name: "review the boards" });
  const reviewGoals = page.getByRole("checkbox", { name: "review the goals" });
  await expect(clearInbox).toHaveAttribute("aria-checked", "false");
  await expect(reviewBoards).toBeVisible();
  await expect(reviewGoals).toBeVisible();

  await clearInbox.click();
  await expect(clearInbox).toHaveAttribute("aria-checked", "true");

  await page.getByLabel("review wins").fill("finished the dashboard");
  await page.getByLabel("review lessons").fill("started late");
  await page.getByLabel("review next").fill("close the notes gap");
  await page.getByRole("button", { name: "complete review" }).click();

  // The wizard lands on the note it just wrote.
  await page.waitForURL(/\/notes\/[^/]+$/u);
  await expect(page.getByLabel("note title")).toHaveValue(/Weekly review/u);
  await expect(page.getByLabel("note body markdown")).toHaveValue(/finished the dashboard/);

  // And the review is recorded, linking to that note.
  await page.goto("/reviews");
  const row = page.locator('[data-slot="review-row"]').first();
  await expect(row).toContainText("weekly");
  await expect(row.getByRole("link", { name: "open note →" })).toBeVisible();

  // It is an ordinary note, so full-text search finds it.
  await page.goto("/notes?q=dashboard");
  await expect(page.locator('[data-slot="note-row"]', { hasText: "Weekly review" })).toBeVisible();
});

/**
 * The streak and the cadence control (ADR-116).
 *
 * Kept separate from the completion test so a failure here is unambiguous: the wizard can be broken
 * without the streak being implicated, and the streak is the reason a weekly review has a weekly
 * rhythm in the first place.
 */
test("reviews: the streak reads zero before any review and the cadence is a real select", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("reviews-streak");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/reviews");

  // A new account has no reviews, so the streak must honestly say zero and the past list must say so
  // in words. A panel showing "1" here would be a fabricated number.
  const streakPanel = page.locator('[data-slot="panel"]', { hasText: "streak" }).first();
  await expect(streakPanel).toBeVisible();
  await expect(streakPanel).toContainText("0");
  await expect(page.getByText("no reviews yet")).toBeVisible();

  // The cadence stays a native select (ADR-116) — asserted by tag name, because that decision is
  // what keeps type-ahead and the mobile wheel working, and a div with a role would look identical.
  const cadence = page.getByLabel("review cadence");
  await expect(cadence).toHaveJSProperty("tagName", "SELECT");
  await expect(cadence).toHaveValue("weekly");
  await cadence.selectOption("monthly");
  await expect(cadence).toHaveValue("monthly");

  // Choosing a monthly cadence must be respected by the review it produces.
  await page.getByLabel("review wins").fill("month in review");
  await page.getByLabel("review lessons").fill("too many contexts");
  await page.getByLabel("review next").fill("one long block a day");
  await page.getByRole("button", { name: "complete review" }).click();
  await page.waitForURL(/\/notes\/[^/]+$/u);
  await expect(page.getByLabel("note title")).toHaveValue(/Monthly review/u);

  // And now there is one, so the streak moves off zero.
  await page.goto("/reviews");
  const row = page.locator('[data-slot="review-row"]').first();
  await expect(row).toContainText("monthly");
  await expect(page.getByText("no reviews yet")).toBeHidden();
});

/**
 * The AI draft (spec §6.2 "pre-filled by AI on request", ADR-116).
 *
 * The e2e environment runs `AI_SCRIPTED=true`, so a model genuinely *does* resolve and the button is
 * correctly present — the "no provider means no button" branch is only reachable in unit tests,
 * where `resolveModel` can be made to return null. What is reachable here is the branch that
 * matters more: the scripted model answers with its canned "no provider configured" reply, which
 * carries no markers, so the draft is unusable and must be reported as such.
 *
 * The load-bearing assertion is the last one. A draft that failed to parse but still filled the
 * textareas would put a fabricated review in front of the user — the exact thing the repo's
 * no-invented-data rule forbids, and the reason `isUsableDraft` exists at all.
 */
test("reviews: an unusable draft reports a reason and fills nothing", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("reviews-ai");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/reviews");

  // The button is offered, because a model does resolve here.
  const draft = page.getByRole("button", { name: "draft with ai" });
  await expect(draft).toBeVisible();

  await draft.click();

  // A named reason, in an alert, rather than three blank boxes that look like a bug. Scoped to the
  // wizard because Next's own route announcer also carries `role="alert"`, and an unscoped
  // `getByRole("alert")` matches both and fails in strict mode.
  await expect(page.locator('[data-slot="review-wizard"] [role="alert"]')).toContainText(
    /unusable/iu,
  );

  // Nothing was written into the answers, and nothing was saved.
  await expect(page.getByLabel("review wins")).toHaveValue("");
  await expect(page.getByLabel("review lessons")).toHaveValue("");
  await expect(page.getByLabel("review next")).toHaveValue("");
  await expect(page).toHaveURL(/\/reviews$/u);

  // And the wizard is still usable: the failed draft cost nothing.
  await page.getByLabel("review wins").fill("wrote this myself");
  await page.getByLabel("review lessons").fill("none today");
  await page.getByLabel("review next").fill("keep going");
  await page.getByRole("button", { name: "complete review" }).click();
  await page.waitForURL(/\/notes\/[^/]+$/u);
  await expect(page.getByLabel("note body markdown")).toHaveValue(/wrote this myself/);
  // The canned reply must not have leaked into the saved review.
  await expect(page.getByLabel("note body markdown")).not.toHaveValue(/scripted/iu);
});
