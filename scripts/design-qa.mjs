/**
 * Design-QA capture (spec §13): screenshot the app so each screen can be compared side by side with
 * the NexaCRM reference in docs/reference/. Output goes to docs/design-qa/.
 *
 *   pnpm dev                       # in another terminal
 *   node scripts/design-qa.mjs     # signed in as the dev-login account
 *
 * Pass credentials as argv: node scripts/design-qa.mjs you@lifeos.local lifeos-demo-1234
 */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const email = process.argv[2] ?? "you@lifeos.local";
const password = process.argv[3] ?? "lifeos-demo-1234";

const ROUTES = [
  ["dashboard", "/dashboard"],
  ["tasks", "/tasks"],
  ["calendar", "/calendar"],
  ["notes", "/notes"],
  ["habits", "/habits"],
  ["goals", "/goals"],
  ["jobs", "/career/jobs"],
  ["analytics", "/career/analytics"],
  ["portfolio", "/career/portfolio"],
  ["finance", "/finance"],
  ["settings", "/settings"],
  ["ai", "/ai"],
];

mkdirSync("docs/design-qa", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`${base}/sign-in`);
await page.getByLabel("email").fill(email);
await page.getByLabel("password").fill(password);
await page.getByRole("button", { name: "sign in" }).click();
await page.waitForURL("**/settings", { timeout: 30_000 });

for (const [name, route] of ROUTES) {
  await page.goto(`${base}${route}`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `docs/design-qa/lifeos-${name}.png`, fullPage: true });
  console.info(`[design-qa] ${name} → docs/design-qa/lifeos-${name}.png`);
}

await browser.close();
