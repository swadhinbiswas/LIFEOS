import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/** Learning-lite (spec §6.6): a course with learner-set progress, and a book marked finished. */
test("learning: add a course, move its progress, finish a book", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("learning");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/learning");

  await page.getByLabel("course title").fill("Distributed systems");
  await page.getByLabel("course provider").fill("MIT OCW");
  await page.getByRole("button", { name: "add course" }).click();

  const course = page.locator('[data-slot="course-row"]', { hasText: "Distributed systems" });
  await expect(course).toContainText("0%");
  await course.getByRole("button", { name: "more progress" }).click();
  await expect(course).toContainText("10%");

  await page.getByLabel("book title").fill("Designing Data-Intensive Applications");
  await page.getByLabel("book author").fill("Martin Kleppmann");
  await page.getByRole("button", { name: "add book" }).click();

  const book = page.locator('[data-slot="book-row"]', { hasText: "Designing Data-Intensive" });
  await expect(book).toBeVisible();
  await book.getByLabel("book status").selectOption("finished");
  // Finishing stamps a date, which is what the row shows.
  await expect(book.locator("time")).toBeVisible();
});
