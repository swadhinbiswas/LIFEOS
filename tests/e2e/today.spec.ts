import { expect, test } from "@playwright/test";

import { createVerifiedUser, serverCard, signIn, uniqueEmail } from "./helpers";

/**
 * Plan my day (spec §6.2): the brief counts real cards, the top three lead with priorities,
 * and `c` carries overdue work into Today — then it survives a reload.
 */
test("plan my day: brief counts, top three, carry-over on c", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("today");

  await createVerifiedUser(page, email);
  await signIn(page, email);

  await page.goto("/inbox");
  const capture = page.getByLabel("capture a task");
  await capture.fill("pay rent yesterday !0");
  await capture.press("Enter");
  await expect(page.locator('[data-slot="inbox-card"]', { hasText: "pay rent" })).toBeVisible();

  await page.goto("/tasks");
  const panel = page.locator('[data-slot="panel"]', { hasText: "Plan my day" });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("carry over overdue (1)");
  await expect(panel).toContainText("pay rent"); // a P0 leads the top three

  // `c` carries the overdue card into Today.
  await page.keyboard.press("c");
  await expect(serverCard(page, "Today", "pay rent")).toBeVisible();
  await page.waitForLoadState("networkidle");

  await page.reload();
  await expect(serverCard(page, "Today", "pay rent")).toBeVisible();
  await expect(page.locator('[data-slot="panel"]', { hasText: "Plan my day" })).toContainText(
    "carry over overdue (0)",
  );
});

/**
 * The three Today widgets spec §6.8 asks for by name — greeting and date, schedule/time blocks,
 * focus timer, quick capture — against a day that actually has something on it. The greeting is
 * asserted structurally (a heading plus a `<time>` with a machine-readable date) rather than against
 * a fixed string, because "good morning" depends on the hour the test runs in.
 */
test("today: greeting, a time-blocked schedule, quick capture and an inline timer", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("today-full");

  await createVerifiedUser(page, email);
  await signIn(page, email);

  // Two timed items today, created through the capture grammar with explicit instants rather than
  // "9am": chrono forward-dates a time that has already passed, so a wall-clock phrase makes this
  // test pass at 08:00 and fail at 09:01. Both instants are clamped inside today in the harness's
  // zone (UTC), because a plain "now + 3h" silently rolls into tomorrow for any run after 21:00 —
  // the strip would then be right and the test wrong.
  const now = new Date();
  const startOfTodayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const nowMinutesUtc = now.getUTCHours() * 60 + now.getUTCMinutes();
  // Clamped into today: 00:05–23:55, so neither end can roll into the neighbouring day.
  const at = (offsetMinutes: number): string =>
    new Date(
      startOfTodayUtc + Math.min(23 * 60 + 55, Math.max(5, nowMinutesUtc + offsetMinutes)) * 60_000,
    ).toISOString();

  await page.goto("/inbox");
  const capture = page.getByLabel("capture a task");
  for (const line of [`standup ${at(-60)} #work`, `review PR ${at(120)} #work`]) {
    await capture.fill(line);
    await capture.press("Enter");
  }
  await expect(page.locator('[data-slot="inbox-card"]')).toHaveCount(2);

  await page.goto("/dashboard?variant=today");

  // Greeting and date: a real <time datetime="YYYY-MM-DD">, not just a formatted string.
  const header = page.locator('[data-slot="day-header"]');
  await expect(header).toBeVisible();
  await expect(header.getByRole("heading", { level: 1 })).toContainText(
    /good (morning|afternoon|evening)/u,
  );
  await expect(header.locator("time")).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}$/u);

  // Schedule: the two blocks carry their own times and are links, not a second list of bare titles.
  const schedule = page.locator('[data-slot="schedule-strip"]');
  await expect(schedule).toBeVisible();
  await expect(schedule.getByRole("link", { name: /standup/u })).toBeVisible();
  await expect(schedule.getByRole("link", { name: /review PR/u })).toBeVisible();
  // Each block's accessible name carries its own time and state, so the strip reads without colour
  // and a screenshot at 3am still tells the truth about where "now" sits.
  const standup = schedule.getByRole("link", { name: /standup/u });
  await expect(standup).toHaveAttribute(
    "aria-label",
    /^\d{2}:\d{2} — standup \((still to come|happening now|done)\)$/u,
  );
  await expect(schedule.getByRole("link", { name: /review PR/u })).toHaveAttribute(
    "aria-label",
    /^\d{2}:\d{2} — review PR \((still to come|happening now|done)\)$/u,
  );
  // Exactly one block is "next" — the single thing to do next.
  await expect(schedule.locator("li", { hasText: "next" })).toHaveCount(1);

  // Quick capture on the dashboard writes to the same Inbox, so it is not a second inbox.
  const dashCapture = page.getByLabel("capture a task");
  await dashCapture.fill("from the dashboard #work");
  await dashCapture.press("Enter");
  await page.goto("/inbox");
  await expect(
    page.locator('[data-slot="inbox-card"]', { hasText: "from the dashboard" }),
  ).toBeVisible();

  // The inline timer starts and stops, and the running session survives a reload.
  await page.goto("/dashboard?variant=today");
  const timer = page.locator('[data-slot="focus-timer"]');
  await timer.getByRole("button", { name: "start 25:00" }).click();
  await expect(page.locator('[data-slot="focus-status"]')).toContainText("session running");
  await page.reload();
  await page
    .locator('[data-slot="focus-timer"]')
    .getByRole("button", { name: "stop session" })
    .click();
  await expect(page.locator('[data-slot="focus-status"]')).toContainText("no session");
});

test("today: an empty day says so rather than drawing a blank timeline", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("today-empty");

  await createVerifiedUser(page, email);
  await signIn(page, email);

  await page.goto("/dashboard?variant=today");
  const empty = page.locator('[data-testid="schedule-empty"]');
  await expect(empty).toBeVisible();
  await expect(empty).toContainText("nothing scheduled today");
  await expect(page.locator('[data-slot="day-header"]')).toBeVisible();
});
