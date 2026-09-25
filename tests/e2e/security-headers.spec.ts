import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * The security headers (docs/SECURITY.md known gaps 1–2, both marked closed) and the WakaTime key at
 * rest. These are claims in a document; without a test they are the kind of claim that quietly stops
 * being true the next time someone edits `next.config.ts`.
 */

test.describe("security headers", () => {
  test("an unauthenticated response carries the full set", async ({ request }) => {
    // Playwright's own `request` fixture, so this follows `baseURL` instead of hardcoding a port
    // and works unchanged on the local port-3500 config. Its `headers()` is a plain record, not a
    // `Headers` object, so keys are read lowercase.
    const headers = (await request.get("/sign-in")).headers();

    const csp = headers["content-security-policy"] ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
    // A production build must not ship `eval`; only dev/HMR needs it.
    expect(csp).not.toContain("unsafe-eval");

    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
  });

  test("an authenticated page carries them too", async ({ page }) => {
    const email = uniqueEmail("headers");
    await createVerifiedUser(page, email);
    await signIn(page, email);

    const response = await page.goto("/dashboard");
    const headers = response?.headers() ?? {};

    // Headers come from `next.config.ts`, not the render, so this is really a check that a route
    // did not opt itself out of the global `source: "/(.*)"` rule.
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
  });
});

test.describe("secrets at rest", () => {
  test("a wakatime key is masked in the ui and absent from the page", async ({ page }) => {
    const email = uniqueEmail("secret-rest");
    await createVerifiedUser(page, email);
    await signIn(page, email);

    await page.goto("/settings/activity");
    const key = "waka_e2e_secret_at_rest_9876543210";
    await page.getByLabel("api key").fill(key);
    await page.getByRole("button", { name: "save", exact: true }).click();

    // The rendered page shows only the tail, and the plaintext appears nowhere in the HTML —
    // not in a hidden input, not in a hydration payload.
    await expect(page.getByText(/•+3210$/u)).toBeVisible();
    expect(await page.content()).not.toContain(key);
  });

  test("a webhook secret is shown once, then never again", async ({ page }) => {
    const email = uniqueEmail("hook-secret");
    await createVerifiedUser(page, email);
    await signIn(page, email);

    await page.goto("/settings/integrations");
    await page
      .getByPlaceholder("https://example.com/hooks/lifeos")
      .fill("https://example.invalid/hook");
    await page.getByRole("button", { name: "add webhook" }).click();

    // `createSecret` is 24 random bytes as hex, so the plaintext is a 48-char hex run inside a
    // <code>. It is shown exactly once, at creation — the only moment it can be copied.
    const shown = page.locator('[data-slot="webhook-secret"] code');
    await expect(shown).toBeVisible();
    const plaintext = (await shown.innerText()).trim();
    expect(plaintext).toMatch(/^[0-9a-f]{48}$/u);

    // After a reload the list shows no secret at all: the stored column is ciphertext and the
    // page has no path back to the plaintext.
    await page.reload();
    const afterReload = await page.content();
    expect(afterReload).not.toContain(plaintext);
    await expect(page.locator('[data-slot="webhook-secret"]')).toHaveCount(0);
    // The row itself is still listed, so the webhook exists — only its secret is gone.
    await expect(page.locator('[data-slot="webhook-row"]')).toHaveCount(1);
  });
});
