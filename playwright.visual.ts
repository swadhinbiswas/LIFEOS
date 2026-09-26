import { defineConfig, devices } from "@playwright/test";

import { e2eEnv } from "./tests/e2e/global-setup";

/**
 * The headed visual sweep (ADR-129) — for the checks a headless browser cannot answer.
 *
 * **Why this exists.** Headless Chromium always draws *overlay* scrollbars, which occupy no space.
 * Four candidate Chromium flags were tried against a control element asking for a 40px custom
 * scrollbar; every one of them measured a 0px gutter. The same page, launched **headed**, measured
 * exactly 40. So "I cannot screenshot or measure the scrollbar" was never a browser limitation to
 * report — it was a missing display, and the fix was one line.
 *
 * That made the earlier claim in ADR-127 and ADR-129 wrong twice over: the themed scrollbar was
 * reported as unverifiable, and a measurement then showed `scrollbar-width: thin` was silently
 * discarding the entire `::-webkit-scrollbar` block in Chromium, so the styling had never applied in
 * the browser that complained about it. Neither a screenshot nor a headless run could have found
 * that. This config can.
 *
 * **It needs a display** (`DISPLAY`, or a virtual one) and it opens real windows, so it is not part
 * of `pnpm e2e` and not in CI. Run it deliberately:
 *
 * ```bash
 * pnpm e2e:visual
 * ```
 *
 * Port 3500 and the same web server as `playwright.local.ts`, for the same reason: never fight the
 * developer's own `next dev` on :3000.
 */
const PORT = 3500;
const ORIGIN = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // The one line the whole config exists for. `::-webkit-scrollbar` is honoured, scrollbars take
    // up space, and a screenshot finally shows what a person sees.
    headless: false,
    viewport: { width: 1280, height: 460 },
  },
  projects: [
    { name: "warmup", testMatch: /warmup\.spec\.ts$/ },
    {
      name: "chromium-headed",
      testIgnore: /warmup\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["warmup"],
    },
  ],
  webServer: {
    command: `pnpm build && pnpm exec next start -p ${PORT}`,
    url: ORIGIN,
    timeout: 300_000,
    stdout: "pipe",
    reuseExistingServer: false,
    env: {
      ...e2eEnv(),
      BETTER_AUTH_URL: ORIGIN,
      NEXT_PUBLIC_APP_URL: ORIGIN,
      TRUSTED_ORIGINS: ORIGIN,
    },
  },
});
