import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * The code variant (ADR-110). The point of these tests is the *unconnected* case: a personal
 * operating system must not draw a plausible-looking chart before a single real number exists.
 * WakaTime's own numbers are never faked here — a live sync needs the user's key, which the
 * service tests cover against the documented shape instead.
 */

test.describe("code activity", () => {
  test("shows an honest empty state and a way in, not invented bars", async ({ page }) => {
    const email = uniqueEmail("code-empty");
    await createVerifiedUser(page, email);
    await signIn(page, email);

    await page.goto("/dashboard?variant=code");

    // The variant is reachable from the tab nav, not a hidden url.
    await expect(page.getByRole("link", { name: "code", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );

    // Four coding KPI tiles, all reporting zero rather than a placeholder figure.
    const tiles = page.locator('[data-slot="signal-tile"]');
    await expect(tiles).toHaveCount(4);
    // `allInnerTexts` uppercases because the suffix span is styled `uppercase`; CSS transforms the
    // text, so the value is compared case-insensitively rather than the markup being asserted.
    for (const value of await tiles.locator("dd > span").allInnerTexts()) {
      expect(value.trim()).toMatch(/^0(?:\.\d+)?(?:\s*[a-z]+)?$/iu);
    }

    // The chart refuses to render bars it has no data for, and says what is missing.
    const time = page.getByRole("heading", { name: "coding time per day", level: 2 });
    await expect(time).toBeVisible();
    const timePanel = page.locator('[data-slot="panel"]', { has: time });
    await expect(timePanel.locator(".recharts-bar-rectangle")).toHaveCount(0);
    await expect(timePanel).toContainText("connect wakatime");
    await expect(timePanel.getByRole("link", { name: "connect wakatime" })).toHaveAttribute(
      "href",
      /\/settings\/activity$/u,
    );

    // The connection widget states the truth: not connected, never synced.
    const connection = page.getByRole("heading", { name: "connection", level: 2 });
    const connectionPanel = page.locator('[data-slot="panel"]', { has: connection });
    await expect(connectionPanel).toContainText("wakatime not connected");
    await expect(connectionPanel).toContainText("never synced");
  });

  test("stores a wakatime key without ever showing it again", async ({ page }) => {
    const email = uniqueEmail("code-key");
    await createVerifiedUser(page, email);
    await signIn(page, email);

    await page.goto("/settings/activity");

    // The setup instructions name the three senders, verified against wakatime's own docs.
    // The three senders, each named with its step: wakatime itself aggregates the CLI, the
    // official OpenCode plugin and its own mobile app, so no separate LifeOS integration is needed
    // per sender.
    await expect(page.getByText("1. wakatime cli")).toBeVisible();
    await expect(page.getByText("2. opencode plugin")).toBeVisible();
    await expect(page.getByText("3. phone")).toBeVisible();

    const key = "waka_e2e_not_a_real_key_0123456789";
    await page.getByLabel("api key").fill(key);
    await page.getByRole("button", { name: "save", exact: true }).click();

    // Only the tail of the key comes back: `maskSecret` keeps four characters, so the rendered
    // value ends in the key's own last four ("6789") and never contains the rest of it.
    const shown = page.getByText(/•+6789$/u);
    await expect(shown).toBeVisible();
    expect(await shown.innerText()).not.toContain(key);

    // And the plaintext is nowhere in the rendered page, hidden input included.
    await expect(page.locator("body")).not.toContainText(key);
    expect(await page.content()).not.toContain(key);
  });
});
