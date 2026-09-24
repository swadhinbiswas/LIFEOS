import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * i18n scaffold (spec §6.9, MVP #30, ADR-053): the example page reads its strings from the
 * catalog, the switch writes the locale cookie, and the choice survives a reload.
 */
test("i18n: the about page switches to Bangla and persists", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("i18n");

  await createVerifiedUser(page, email);
  await signIn(page, email);

  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "About", level: 1 })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.getByRole("button", { name: "বাংলা" }).click();
  await expect(page.getByRole("heading", { name: "পরিচিতি", level: 1 })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  // The chrome is translated too, not only the page body (ADR-060).
  await expect(page.getByRole("link", { name: "ড্যাশবোর্ড" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0);

  // A page body is translated as well (ADR-072).
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "ড্যাশবোর্ড", level: 1 })).toBeVisible();

  // The cookie is the source of truth, so a reload keeps the language.
  await page.reload();
  await expect(page.getByRole("heading", { name: "ড্যাশবোর্ড", level: 1 })).toBeVisible();

  // The switch lives on the about page; switching back restores English.
  await page.goto("/about");
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { name: "About", level: 1 })).toBeVisible();
});
