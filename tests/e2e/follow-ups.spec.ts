import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * The tracker fields taken from a real reference workspace (ADR-114), and the promise model that
 * came with them. The point of the first test is that a *dated* next action and a *dated* follow-up
 * both show up as things owed — before this, a follow-up had nowhere to live, because it has a due
 * date and no start time.
 */
test.describe("follow-ups", () => {
  test("lists a dated follow-up and a dated next action, and marks what is late", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const email = uniqueEmail("followups");

    await createVerifiedUser(page, email);
    await signIn(page, email);

    // An application through the UI. The form lands on the new job's own page, so there is no card
    // list to go back to — the detail page *is* the destination.
    await page.goto("/career/jobs");
    await page.getByLabel("job title").fill("Platform Engineer");
    await page.getByLabel("company").fill("Northwind");
    await page.getByRole("button", { name: "add job" }).click();
    await page.waitForURL(/\/career\/jobs\/[^/]+$/u);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Platform Engineer");

    // The detail page carries the new fields, and says so honestly when they are empty.
    await expect(page.getByText("nothing written down yet")).toBeVisible();
    await expect(page.getByText("apply by")).toBeVisible();
    await expect(page.getByLabel("next action")).toBeVisible();

    // The list itself is honest when nothing is owed.
    await page.goto("/career/follow-ups");
    await expect(page.getByText("no follow-ups and no dated next actions")).toBeVisible();

    // Now write down a promise, through the form on the detail page — a field you can read but
    // not write is a field nobody fills in.
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Platform Engineer");
    await page.getByLabel("next action").fill("ask about the on-call rotation");
    // Yesterday, so the row is genuinely late rather than late only at some future hour.
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await page.getByLabel("due date").fill(yesterday);
    await page.getByRole("button", { name: "save next action" }).click();
    await expect(page.getByText("next action saved")).toBeVisible();

    await page.goto("/career/follow-ups");
    const owed = page.locator('[data-slot="follow-up"]');
    await expect(owed).toHaveCount(1);
    // A date in the past is reported as late in words, not only in colour.
    await expect(owed).toHaveAttribute("data-overdue", "true");
    await expect(owed).toContainText("late");
    await expect(owed).toContainText("ask about the on-call rotation");
    await expect(owed.getByRole("link", { name: "Platform Engineer" })).toBeVisible();
  });

  test("is reachable from the career nav, and its title is translated", async ({ page }) => {
    test.setTimeout(90_000);
    const email = uniqueEmail("followups-nav");
    await createVerifiedUser(page, email);
    await signIn(page, email);

    await page.goto("/about");
    await page.getByRole("button", { name: "বাংলা" }).click();
    // Wait for the switch to land before navigating: the cookie is written by the client, and a
    // goto that races it silently gets the previous locale.
    await expect(page.locator("html")).toHaveAttribute("lang", "bn");

    await page.goto("/career/follow-ups");
    await expect(page.getByRole("heading", { name: "ফলো-আপ", level: 1 })).toBeVisible();
    await expect(page).toHaveTitle("ফলো-আপ · LifeOS");
  });
});
