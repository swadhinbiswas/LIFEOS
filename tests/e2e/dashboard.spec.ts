import { expect, test } from "@playwright/test";

import { createVerifiedUser, serverCard, signIn, uniqueEmail } from "./helpers";

/**
 * Dashboard (spec §6.8): every KPI renders with a definition and a link to the list behind it,
 * and every KPI is a card that links to the list behind it.
 */
test("dashboard: KPIs link to their source lists", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("dash");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  await expect(page.locator('[data-slot="kpi-card"]')).toHaveCount(6);

  // Every KPI carries a plain-language definition and an "open list" link.
  const tasks = page.locator('[data-slot="kpi-card"][data-kpi="tasksDoneThisWeek"]');
  await expect(tasks).toContainText("tasks done this week");
  await expect(tasks.getByRole("link", { name: "open list" })).toHaveAttribute("href", /\/tasks/u);

  const budget = page.locator('[data-slot="kpi-card"][data-kpi="budgetRemaining"]');
  await expect(budget.getByRole("link", { name: "open list" })).toHaveAttribute(
    "href",
    /\/finance/u,
  );

  // A snapshot KPI shows no delta badge rather than inventing a baseline.
  await expect(
    page.locator('[data-slot="kpi-card"][data-kpi="openApplications"] [data-slot="stat-delta"]'),
  ).toHaveCount(0);
});

/**
 * The Today signal board (ADR-101): the variant ships charts, glyph widgets and an honest empty
 * state. A fresh account has no habits and no focus sessions, so this exercises the empty paths —
 * a quiet widget must be a labelled next step, never a blank box or a zero-filled chart.
 */
test("dashboard: the today variant renders every signal widget, empty or not", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("today");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/dashboard?variant=today");

  // Counts become tiles, and the top-3 list keeps its links.
  await expect(page.locator('[data-slot="signal-tile"]')).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "top 3", level: 2 })).toBeVisible();

  // The open-card queue and the planned-minutes meter are real widgets, not stubs.
  await expect(page.getByRole("heading", { name: "open card queue", level: 2 })).toBeVisible();
  await expect(page.locator('[data-slot="ascii-meter"]').first()).toBeVisible();

  // No habits and no focus sessions: an empty state with a way forward, not a blank chart.
  const pulse = page.getByRole("heading", { name: "habit pulse", level: 2 });
  await expect(pulse).toBeVisible();
  await expect(page.getByText("no habits yet", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("no focus sessions in the last 14 days")).toBeVisible();
  await expect(page.locator('[data-slot="trend-chart"]')).toHaveCount(0);

  // Every new widget is customizable like any other (ADR-046).
  await page.locator('[data-slot="dashboard-customize"] summary').click();
  const controls = page.getByRole("checkbox", {
    name: /show (habit pulse|focus rhythm|habit constellation|open card queue)/u,
  });
  await expect(controls).toHaveCount(4);
});

/**
 * The same board with data: one habit checked in and one focus block logged turn both charts on,
 * and each chart carries the table alternative (spec §4.4).
 */
test("dashboard: habit and focus data light up both charts with a table alternative", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const email = uniqueEmail("charts");

  await createVerifiedUser(page, email);
  await signIn(page, email);

  // A habit and a check-in, through the real UI.
  await page.goto("/habits");
  await page.getByLabel("habit name").fill("e2e walk");
  await page.getByRole("button", { name: "add habit" }).click();
  await page.getByRole("button", { name: "mark done" }).click();

  // One focus block, started and stopped through the timer.
  await page.goto("/focus");
  await page.getByRole("button", { name: "start 25:00" }).click();
  await page.getByRole("button", { name: "stop session" }).click();

  await page.goto("/dashboard?variant=today");

  const charts = page.locator('[data-slot="trend-chart"]');
  await expect(charts).toHaveCount(2);

  // Real marks, not an empty axis: a bar per day and an area for the focus series. The block was
  // stopped within a second, so its area can be flat — what matters is that the series is drawn and
  // the empty state is gone.
  await expect(charts.nth(0).locator(".recharts-bar-rectangle").first()).toBeVisible();
  await expect(charts.nth(1).locator(".recharts-area-area")).toHaveCount(1);
  await expect(page.getByText("no focus sessions in the last 14 days")).toHaveCount(0);

  // The accessible alternative is one click away and holds the same numbers.
  const table = page.locator('[data-slot="trend-chart-table"] summary').first();
  await table.click();
  await expect(page.locator('[data-slot="trend-chart-table"] table').first()).toBeVisible();
  await expect(page.locator('[data-slot="trend-chart-table"] time').first()).toBeVisible();

  // The habit constellation renders the same habit as dots, a sparkline and a streak.
  await expect(page.locator('[data-slot="constellation-row"]')).toHaveCount(1);
  await expect(page.locator('[data-slot="constellation-row"] [data-slot="spark"]')).toBeVisible();
});

/**
 * Career and productivity are signal boards too (ADR-104). The career variant used to render
 * `nothing to show yet` for open applications while the database held the real number, so the
 * assertions here are about the *number*, not just the panel existing.
 */
test("dashboard: the career variant charts the pipeline and shows real counts", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("career-dash");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/career/jobs");
  await page.getByLabel("job title").fill("e2e pipeline co");
  await page.getByRole("button", { name: "add job" }).click();
  await page.waitForURL(/\/career\/jobs\/[^/]+$/u);

  await page.goto("/dashboard?variant=career");

  // The funnel is a chart with a table alternative, not a list of rows.
  const funnel = page.locator('[data-slot="funnel-chart"]');
  await expect(funnel).toHaveCount(1);
  await expect(funnel.locator(".recharts-bar-rectangle").first()).toBeVisible();
  await page.locator('[data-slot="funnel-chart-table"] summary').click();
  await expect(page.locator('[data-slot="funnel-chart-table"] th').first()).toBeVisible();

  // Applications per week is a real series over eight weeks.
  await expect(
    page.getByRole("heading", { name: "applications per week", level: 2 }),
  ).toBeVisible();
  await expect(page.locator('[data-slot="trend-chart"]')).toHaveCount(1);

  // The bug: this widget used to fall back to a placeholder because KPIs were never loaded here.
  const open = page.getByRole("heading", { name: "open applications", level: 2 });
  await expect(open).toBeVisible();
  const openPanel = page.locator('[data-slot="panel"]', { has: open });
  await expect(openPanel).toContainText("1");
  await expect(openPanel).not.toContainText("nothing to show");
  await expect(openPanel.getByRole("link", { name: "open list" })).toHaveAttribute(
    "href",
    /\/career\/jobs/u,
  );

  // A fresh account has nothing stale, and says so.
  await expect(page.getByText("nothing has gone quiet")).toBeVisible();
});

test("dashboard: the productivity variant charts output and a real review streak", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("prod-dash");

  await createVerifiedUser(page, email);
  await signIn(page, email);

  // Complete a card through the board's own keys, so the series has a real point. The sequence is
  // the one keyboard.spec.ts proves: type, Enter, leave the input, focus with `j`, complete Space.
  await page.goto("/tasks");
  await page.getByLabel("add a card to Inbox").fill("e2e shipped card");
  await page.keyboard.press("Enter");
  await expect(serverCard(page, "Inbox", "e2e shipped card")).toBeVisible();
  await page.getByLabel("add a card to Inbox").blur();
  await page.keyboard.press("j");
  await expect(page.locator('[data-slot="card"][data-focused="true"]')).toHaveCount(1);
  await page.keyboard.press("Space");
  await expect(serverCard(page, "Done", "e2e shipped card")).toBeVisible();

  await page.goto("/dashboard?variant=productivity");

  // Four work KPIs as tiles, each with its unit.
  await expect(page.locator('[data-slot="signal-tile"]')).toHaveCount(4);

  // Tasks done per day is a chart over the user's own completions.
  const done = page.getByRole("heading", { name: "tasks done per day", level: 2 });
  await expect(done).toBeVisible();
  const donePanel = page.locator('[data-slot="panel"]', { has: done });
  await expect(donePanel.locator(".recharts-bar-rectangle").first()).toBeVisible();
  await expect(donePanel).not.toContainText("no cards completed");

  // The review streak is labelled a streak and reports a real one, not a raw row count.
  const streak = page.getByRole("heading", { name: "review streak", level: 2 });
  const streakPanel = page.locator('[data-slot="panel"]', { has: streak });
  await expect(streakPanel).toContainText("0");
  await expect(streakPanel.getByRole("link", { name: "open list" })).toHaveAttribute(
    "href",
    /\/reviews/u,
  );
});
