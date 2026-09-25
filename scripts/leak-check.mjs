import { chromium } from "@playwright/test";

// With JS disabled the form submits natively — the exact case that leaked credentials to the URL.
const browser = await chromium.launch();
const context = await browser.newContext({ javaScriptEnabled: false });
const page = await context.newPage();

await page.goto("http://localhost:3000/sign-in");
await page.getByLabel("email").fill("leak-check@example.test");
await page.getByLabel("password").fill("super-secret-password");
await page.getByRole("button", { name: "sign in" }).click();
await page.waitForLoadState("domcontentloaded");

const url = page.url();
console.log("url:", url);
console.log("leaked:", /password|super-secret/i.test(url));

// Same check for sign-up.
await page.goto("http://localhost:3000/sign-up");
await page.getByLabel("name").fill("Leak Check");
await page.getByLabel("email").fill("leak-check@example.test");
await page.getByLabel("password").fill("super-secret-password");
await page.getByRole("button", { name: "create account" }).click();
await page.waitForLoadState("domcontentloaded");
console.log("signup url:", page.url());
console.log("signup leaked:", /password|super-secret/i.test(page.url()));

await browser.close();
