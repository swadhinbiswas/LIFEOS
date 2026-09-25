import { chromium } from "@playwright/test";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch();

// 1. JS disabled, starting from a URL that already carries credentials (the inherited-query case).
const noJs = await browser.newContext({ javaScriptEnabled: false });
const p1 = await noJs.newPage();
await p1.goto(`${base}/sign-in?email=leak@example.test&password=super-secret`);
await p1.getByLabel("password").fill("super-secret");
await p1.getByRole("button", { name: "sign in" }).click();
await p1.waitForLoadState("domcontentloaded");
console.log("no-js submit url:", p1.url(), "| leaked:", /password|super-secret/i.test(p1.url()));

// 2. JS enabled, arriving with credentials in the URL: the scrubber must clean the address bar.
const p2 = await (await browser.newContext()).newPage();
await p2.goto(`${base}/sign-in?email=leak@example.test&password=super-secret`);
await p2.waitForLoadState("networkidle");
console.log("scrubbed url:", p2.url(), "| leaked:", /password|super-secret/i.test(p2.url()));

// 3. The public demo renders sample data.
const p3 = await (await browser.newContext()).newPage();
await p3.goto(`${base}/demo`);
const body = await p3.textContent("body");
console.log(
  "demo has sample data:",
  /research-based seed/i.test(body) && /MLOps Engineer/.test(body),
);

await browser.close();
