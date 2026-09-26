import { expect, type Page } from "@playwright/test";

import { newestMail } from "./outbox";

export const PASSWORD = "e2e-password-9x7k";

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

/** Sign up, follow the mailed verification link, land on the verified state. */
export async function createVerifiedUser(
  page: Page,
  email: string,
  password = PASSWORD,
): Promise<void> {
  await page.goto("/sign-up");
  await page.getByLabel("name").fill("E2E User");
  await page.getByLabel("email").fill(email);
  await page.getByLabel("password").fill(password);
  await page.getByRole("button", { name: "create account" }).click();
  await expect(page.getByText(`verification mail sent to ${email}`)).toBeVisible();

  const mail = newestMail("verify");
  expect(mail.to).toBe(email);
  await page.goto(mail.url);
  await expect(page.getByText("email verified")).toBeVisible();
}

/** Sign in and wait for the proxy/layout to land on the settings shell. */
export async function signIn(
  page: Page,
  email: string,
  password = PASSWORD,
  options: { onboard?: boolean } = {},
): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("email").fill(email);
  await page.getByLabel("password").fill(password);
  await page.getByRole("button", { name: "sign in" }).click();
  await page.waitForURL("**/settings");
  if (options.onboard !== false) await completeOnboarding(page);
}

/**
 * Finish onboarding, so a test user is marked onboarded and nothing else about their account
 * changes. The onboarding spec itself passes `{ onboard: false }` to exercise the real flow.
 *
 * Two steps: name → starter board. It used to be three, with a sample-profile picker in the middle
 * and a "blank" radio to opt out of it; both are gone with the seed module (ADR-123), so this helper
 * clicked a control that no longer exists and every signed-in test timed out on it. The account is
 * now always created empty, so there is nothing to opt out of.
 */
export async function completeOnboarding(page: Page): Promise<void> {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "next" }).click();
  await page.getByRole("button", { name: "finish setup" }).click();
  await page.waitForURL("**/dashboard");
}

/**
 * A board column by name. Attribute-based on purpose: while a modal (the card sheet) is open,
 * Radix marks the rest of the page `aria-hidden`, so role-based locators cannot see the board.
 */
export const column = (page: Page, name: string) =>
  page.locator(`section[data-slot="board-column"][data-column-name="${name}"]`);

/**
 * The server-confirmed card in a column. Optimistic rows carry a `pending-…` id, so selecting
 * the non-pending one is how a test waits for a write to have actually landed.
 */
export const serverCard = (page: Page, columnName: string, title: string) =>
  column(page, columnName).locator(`[data-slot="card"]:not([data-card-id^="pending-"])`, {
    hasText: title,
  });
