import { defineConfig, devices } from "@playwright/test";

import { e2eEnv } from "./tests/e2e/global-setup";

/**
 * E2E harness (ADR-029): one dev server, one isolated database, one shared outbox
 * mailbox — so runs stay strictly serial and never reuse a server that was started
 * without the E2E DATABASE_URL.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    // ADR-038: warm the server's auth graph over HTTP before any browser test, so the
    // native libsql loader's expensive glibc probe runs on a small heap.
    { name: "warmup", testMatch: /warmup\.spec\.ts$/ },
    {
      name: "chromium",
      testIgnore: /warmup\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["warmup"],
    },
  ],
  webServer: {
    // ADR-029: exercise the production build, not the dev server. Prod loads the auth graph
    // once at boot on a small heap, so the ADR-038 warm-up is a cheap guard rather than a
    // load-bearing fix; dev-only behaviour (StrictMode double effects) is not what users run.
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    timeout: 240_000,
    stdout: "pipe",
    // A stray server on :3000 would answer against the development database —
    // fail fast instead of silently testing the wrong data.
    reuseExistingServer: false,
    env: e2eEnv(),
  },
});
