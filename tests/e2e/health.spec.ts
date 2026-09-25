import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * The health probe is a deployment gate, so its contract is asserted here (ADR-113).
 *
 * It used to answer `select 1` and nothing else, which succeeds against a database several
 * migrations behind — the state that served `SQLITE_ERROR: no such table` on the dashboard while
 * the whole gate was green. A probe that cannot tell "current" from "reachable" is not a readiness
 * check.
 */
test.describe("health probe", () => {
  test("reports migration state, not just that the socket is open", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);

    const body = (await response.json()) as {
      ok: boolean;
      service: string;
      database: string;
      migrations: { expected: number; applied: number; pending: number; unknown: boolean };
    };

    expect(body.ok).toBe(true);
    expect(body.service).toBe("lifeos");
    // The E2E database is migrated by global-setup, so it is current by construction.
    expect(body.migrations.expected).toBeGreaterThan(0);
    expect(body.migrations.pending).toBe(0);
    expect(body.migrations.applied).toBe(body.migrations.expected);
  });

  test("stays green for a signed-in user, so the probe is not auth-gated", async ({ page }) => {
    const email = uniqueEmail("health");
    await createVerifiedUser(page, email);
    await signIn(page, email);

    const response = await page.request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(((await response.json()) as { ok: boolean }).ok).toBe(true);
  });

  test("the dashboard reads tables the probe says exist", async ({ page }) => {
    // The end-to-end version of the same claim: if the probe says current and the dashboard still
    // raises SQLITE_ERROR, the probe is lying about something.
    const email = uniqueEmail("health-dash");
    await createVerifiedUser(page, email);
    await signIn(page, email);

    const health = await page.request.get("/api/health");
    const pending = ((await health.json()) as { migrations: { pending: number } }).migrations
      .pending;
    expect(pending).toBe(0);

    await page.goto("/dashboard?variant=code");
    // The activity widgets read `code_activity_daily`; the unconnected state is the honest render.
    await expect(page.getByRole("heading", { name: "connection", level: 2 })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("no such table");
  });
});
