import { expect, test } from "@playwright/test";

import { newestMail } from "./outbox";

const PASSWORD = "e2e-password-9x7k";

const uniqueEmail = (): string =>
  `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;

test("sign up, verify by the mailed link, then sign in", async ({ page, context }) => {
  const email = uniqueEmail();

  // Sign up — requireEmailVerification is on, so this ends in a "check your mail" state.
  await page.goto("/sign-up");
  await page.getByLabel("name").fill("E2E Tester");
  await page.getByLabel("email").fill(email);
  await page.getByLabel("password").fill(PASSWORD);
  await page.getByRole("button", { name: "create account" }).click();
  await expect(page.getByText(`verification mail sent to ${email}`)).toBeVisible();

  // Sign-in is blocked until the address is verified (ADR-037). The attempt re-sends the
  // verification mail, so the newest verify mail read below is that fresh link.
  await page.goto("/sign-in");
  await page.getByLabel("email").fill(email);
  await page.getByLabel("password").fill(PASSWORD);
  await page.getByRole("button", { name: "sign in" }).click();
  await expect(page.getByText("email not verified yet")).toBeVisible();

  const verifyMail = newestMail("verify");
  expect(verifyMail.to).toBe(email);
  await page.goto(verifyMail.url);
  await expect(page.getByText("email verified")).toBeVisible();

  // Now a real sign-in: the session cookie lands and the proxy sends us onward.
  await page.goto("/sign-in");
  await page.getByLabel("email").fill(email);
  await page.getByLabel("password").fill(PASSWORD);
  await page.getByRole("button", { name: "sign in" }).click();
  await page.waitForURL("**/settings");
  const cookies = await context.cookies();
  expect(cookies.some((cookie) => cookie.name === "better-auth.session_token")).toBe(true);

  // Signed-in users are kept out of the auth routes (ADR-026).
  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/settings$/);
});

test("stale session cookie cannot create a redirect loop", async ({ page, context }) => {
  await page.goto("/");
  await context.addCookies([
    {
      name: "better-auth.session_token",
      value: "stale-session-token",
      url: new URL(page.url()).origin,
    },
  ]);

  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

  await page.goto("/settings");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("password reset: mailed link replaces the password", async ({ page }) => {
  const email = uniqueEmail();

  // An existing, verified account to reset.
  await page.goto("/sign-up");
  await page.getByLabel("name").fill("E2E Reset");
  await page.getByLabel("email").fill(email);
  await page.getByLabel("password").fill(PASSWORD);
  await page.getByRole("button", { name: "create account" }).click();
  await expect(page.getByText(`verification mail sent to ${email}`)).toBeVisible();
  const verifyMail = newestMail("verify");
  expect(verifyMail.to).toBe(email);
  await page.goto(verifyMail.url);
  await expect(page.getByText("email verified")).toBeVisible();

  // Request the reset — the copy never reveals whether the account exists.
  await page.goto("/forgot-password");
  await page.getByLabel("email").fill(email);
  await page.getByRole("button", { name: "send reset link" }).click();
  await expect(page.getByText(`if ${email} has an account`)).toBeVisible();

  // Follow Better Auth's origin-checked hop from the real mailed URL to the spec §5 page.
  const resetMail = newestMail("reset");
  expect(resetMail.to).toBe(email);
  await page.goto(resetMail.url);
  await expect(page).toHaveURL(/\/reset-password\?token=/);
  await page.getByLabel("new password").fill("e2e-new-password-4t");
  await page.getByLabel("confirm password").fill("e2e-new-password-4t");
  await page.getByRole("button", { name: "set new password" }).click();
  await expect(page.getByText("password updated")).toBeVisible();
  await page.getByRole("link", { name: "continue" }).click();
  await expect(page).toHaveURL(/\/sign-in\?notice=reset$/);
  await expect(page.getByText("password updated — sign in")).toBeVisible();

  // The old password is dead…
  await page.getByLabel("email").fill(email);
  await page.getByLabel("password").fill(PASSWORD);
  await page.getByRole("button", { name: "sign in" }).click();
  await expect(page.getByText("wrong email or password")).toBeVisible();

  // …and the new one works.
  await page.getByLabel("password").fill("e2e-new-password-4t");
  await page.getByRole("button", { name: "sign in" }).click();
  await page.waitForURL("**/settings");
});
