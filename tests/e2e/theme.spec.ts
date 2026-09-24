import { expect, test, type Page } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/** Option names repeat across axes ("SM"/"LG"/"Full"), so every click is scoped to its group. */
const axis = (page: Page, legend: string) => page.getByRole("radiogroup", { name: legend });

/**
 * Phase 1 acceptance (spec §13 / ADR-024/029): every customizer axis updates the document
 * live, survives a reload (cookie first paint + DB hydration), and follows the user through
 * a sign-out/sign-in round trip.
 */
test("every customizer axis updates live and persists", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("theme");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/settings/appearance");

  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-preset", "midnight");

  // Palette: Paper is the native-light preset, so it also resolves the theme attribute.
  await axis(page, "preset").getByRole("radio", { name: "Paper" }).click();
  await expect(html).toHaveAttribute("data-preset", "paper");
  await expect(html).toHaveAttribute("data-theme", "paper");

  // Colour mode dark while on a light preset resolves to the Midnight dark palette (ADR-024).
  await axis(page, "color mode").getByRole("radio", { name: "Dark" }).click();
  await expect(html).toHaveAttribute("data-color-mode", "dark");
  await expect(html).toHaveAttribute("data-theme", "midnight");

  // Typography, geometry, sidebar.
  await axis(page, "font").getByRole("radio", { name: "Fira Code" }).click();
  await expect(html).toHaveAttribute("data-font", "fira-code");
  await axis(page, "ligatures").getByRole("radio", { name: "On" }).click();
  await expect(html).toHaveAttribute("data-ligatures", "on");
  await axis(page, "radius").getByRole("radio", { name: "LG" }).click();
  await expect(html).toHaveAttribute("data-radius", "lg");
  await axis(page, "scale").getByRole("radio", { name: "SM" }).click();
  await expect(html).toHaveAttribute("data-scale", "sm");
  await axis(page, "content layout").getByRole("radio", { name: "Full" }).click();
  await expect(html).toHaveAttribute("data-layout", "full");
  await axis(page, "sidebar variant").getByRole("radio", { name: "Inset" }).click();
  await expect(html).toHaveAttribute("data-sidebar-variant", "inset");
  await axis(page, "sidebar mode").getByRole("radio", { name: "Icon" }).click();
  await expect(html).toHaveAttribute("data-sidebar-mode", "icon");

  // Custom accent regenerates primary and records data-accent. React's value tracker needs
  // the native setter to notice a scripted change, hence the descriptor dance.
  await page.locator("#accent").evaluate((element) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "#ff0055");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(html).toHaveAttribute("data-accent", "#ff0055");

  // Let the debounced persistence write the cookie + DB row, then reload: SSR replay.
  await page.waitForTimeout(700);
  await page.reload();
  await expect(html).toHaveAttribute("data-preset", "paper");
  await expect(html).toHaveAttribute("data-font", "fira-code");
  await expect(html).toHaveAttribute("data-radius", "lg");
  await expect(html).toHaveAttribute("data-scale", "sm");
  await expect(html).toHaveAttribute("data-sidebar-mode", "icon");
  await expect(html).toHaveAttribute("data-accent", "#ff0055");

  // Round trip: sign out, sign in again — the per-user DB row must restore the same set.
  await page.getByRole("button", { name: "sign out" }).click();
  await page.waitForURL("**/sign-in");
  await signIn(page, email);
  await page.goto("/settings/appearance");
  await expect(html).toHaveAttribute("data-preset", "paper");
  await expect(html).toHaveAttribute("data-font", "fira-code");
  await expect(html).toHaveAttribute("data-radius", "lg");
  await expect(html).toHaveAttribute("data-sidebar-variant", "inset");
  await expect(html).toHaveAttribute("data-accent", "#ff0055");
});
