import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type BrowserContext, type Locator, type Page } from "@playwright/test";

import globalSetup, { e2eEnv } from "../tests/e2e/global-setup";
import { newestMail } from "../tests/e2e/outbox";

/**
 * Records the README demo: one scripted take through the app, encoded to MP4, an inline GIF
 * highlight and a poster frame (`docs/media/`).
 *
 *   pnpm demo:record                    # build, boot :3500, record, encode
 *   pnpm demo:record -- --attach        # reuse a server already on :3500 (fast iteration)
 *   pnpm demo:record -- --skip-build    # reuse the existing .next build
 *   pnpm demo:record -- --gif-chapter copilot
 *
 * **Why it is scripted and not hand-driven.** A README video that has to be re-cut after every
 * interface change is a video that goes stale. This one is a test in all but name: it drives the
 * app through the same accessible names the Playwright specs use, it waits for the server to confirm
 * each write (`serverCard` semantics) instead of sleeping a guess, and it fails loudly rather than
 * recording a broken half-take. Re-run it and the media matches the build.
 *
 * **What is in the frame.** Real UI, a real database (the isolated `tests/e2e/.e2e.db`, rebuilt from
 * `./drizzle` before every take), and an account created empty by the app's own onboarding. Nothing
 * is seeded or invented: every card, habit, note and label in the video was typed by this script into
 * the running product. The copilot answers with the scripted model (`AI_SCRIPTED=true`), which is
 * labelled as such in the UI, so the take needs no provider key and promises no real model.
 *
 * The web server runs on port 3500 with `e2eEnv()` for the same reasons as `playwright.local.ts`:
 * never fight the developer's `next dev` on :3000, and keep the run hermetic (in-memory rate limiting,
 * file outbox, no Turso, no paid keys).
 */

const PORT = 3500;
const ORIGIN = `http://localhost:${PORT}`;
const MEDIA_DIR = join(process.cwd(), "docs", "media");
const RAW_DIR = join(MEDIA_DIR, ".raw");
const EMAIL = "demo@lifeos.local";
const PASSWORD = "recorded-demo-9x7k";

const WIDTH = 1920;
const HEIGHT = 1080;

interface Chapter {
  readonly name: string;
  /** Seconds from the start of the recording. */
  readonly at: number;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/** `--gif-chapter copilot` / `--gif-seconds 12`, with sane defaults. */
function flagValue(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index === -1 ? undefined : process.argv[index + 1];
  return value ?? fallback;
}

/** Prints what it ran, so a re-record is reviewable from the terminal output alone. */
function run(command: string, args: readonly string[], env: NodeJS.ProcessEnv): void {
  console.info(`[record] $ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", env });
  if (result.status !== 0) {
    throw new Error(`"${command} ${args.join(" ")}" exited with ${String(result.status)}`);
  }
}

async function waitForServer(child: ReturnType<typeof spawn> | null): Promise<void> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error(`the web server exited early with code ${String(child.exitCode)}`);
    }
    try {
      const response = await fetch(`${ORIGIN}/api/health`);
      if (response.ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("the web server did not answer /api/health within 120s");
}

// --- The take -------------------------------------------------------------------

/** Waits for a locator without Playwright's `expect`, which needs a test-runner context. */
async function shown(locator: Locator, timeout = 20_000): Promise<Locator> {
  await locator.first().waitFor({ state: "visible", timeout });
  return locator;
}

/**
 * Press a board view key until the URL answers. Copied in intent from `pressViewKey` in
 * `tests/e2e/boards.spec.ts`: the key listener attaches on hydration, and `goto` resolves first, so
 * one press can be swallowed for good.
 */
async function pressViewKey(page: Page, key: string, expected: string): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await page.keyboard.press(key);
    if (page.url().includes(`view=${expected}`)) return;
    await page.waitForTimeout(200);
  }
  throw new Error(`view key "${key}" never produced view=${expected} (${page.url()})`);
}

async function blur(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

/** The card in a column once the server has confirmed the write (same rule as `serverCard`). */
function serverCard(page: Page, columnName: string, title: string): Locator {
  return page
    .locator(`section[data-slot="board-column"][data-column-name="${columnName}"]`)
    .locator(`[data-slot="card"]:not([data-card-id^="pending-"])`, { hasText: title });
}

async function tour(context: BrowserContext): Promise<Chapter[]> {
  const page = await context.newPage();
  const chapters: Chapter[] = [];
  const started = Date.now();
  const mark = (name: string): void => {
    chapters.push({ name, at: (Date.now() - started) / 1000 });
    console.info(`[record] ${name.padEnd(12)} @ ${((Date.now() - started) / 1000).toFixed(1)}s`);
  };
  const hold = (ms: number): Promise<void> => page.waitForTimeout(ms);

  // Sign up, verify through the file outbox, finish onboarding on the starter board.
  await page.goto("/sign-up");
  await page.getByLabel("name").fill("LifeOS Demo");
  await page.getByLabel("email").fill(EMAIL);
  await page.getByLabel("password").fill(PASSWORD);
  await page.getByRole("button", { name: "create account" }).click();
  await shown(page.getByText(`verification mail sent to ${EMAIL}`));
  await page.goto(newestMail("verify").url);
  await shown(page.getByText("email verified"));

  await page.goto("/onboarding");
  await page.getByRole("button", { name: "next" }).click();
  await page.getByRole("radio", { name: /daily kanban/iu }).check();
  await page.getByRole("button", { name: "finish setup" }).click();
  await page.waitForURL("**/dashboard");

  // 1. Capture with the natural-language grammar — the live parse preview is the point.
  mark("capture");
  await page.goto("/inbox");
  const capture = page.getByLabel("capture a task");
  await capture.click();
  await capture.type("review the pull request tomorrow 5pm #work !2", { delay: 22 });
  await shown(page.getByText("adds:"));
  await hold(1400);
  await capture.press("Enter");
  await shown(page.locator('[data-slot="inbox-card"]', { hasText: "review the pull request" }));
  await hold(900);

  // 2. The board: quick add, move, and the card sheet with checklist, label and comment.
  mark("board");
  await page.goto("/tasks");
  await shown(page.getByRole("heading", { name: "Tasks", level: 1 }));
  const adder = page.getByLabel("add a card to Inbox");
  await adder.click();
  await adder.type("sketch the onboarding flow", { delay: 18 });
  await adder.press("Enter");
  await shown(serverCard(page, "Inbox", "sketch the onboarding flow"));
  await adder.click();
  await adder.type("update the roadmap", { delay: 18 });
  await adder.press("Enter");
  await shown(serverCard(page, "Inbox", "update the roadmap"));
  await hold(700);

  await serverCard(page, "Inbox", "update the roadmap")
    .getByRole("button", { name: "move update the roadmap right" })
    .click();
  await shown(serverCard(page, "Today", "update the roadmap"));
  await hold(700);

  const card = await shown(serverCard(page, "Today", "update the roadmap"));
  const cardId = await card.getAttribute("data-card-id");
  if (cardId === null) throw new Error("the moved card carried no data-card-id");
  await page.goto(`/tasks?card=${cardId}`);
  const sheet = page.getByRole("dialog");
  await shown(sheet);
  await hold(600);

  mark("checklist");
  const checklist = sheet.locator('[data-slot="card-checklist"]');
  const subtask = checklist.getByLabel("add a subtask");
  for (const item of ["split the board module", "write the migration"]) {
    await subtask.fill(item);
    await subtask.press("Enter");
    await shown(checklist.getByText(item));
  }
  await checklist.getByRole("checkbox", { name: "split the board module" }).check();
  await hold(900);

  mark("labels");
  const labels = sheet.locator('[data-slot="card-labels"]');
  await labels.getByLabel("new label").fill("urgent");
  await labels.getByLabel("colour").selectOption("destructive");
  await labels.getByRole("button", { name: "add" }).click();
  await shown(labels.locator('[data-slot="label-chip"][data-label-name="urgent"]'));
  await hold(800);

  mark("comments");
  const comments = sheet.locator('[data-slot="card-comments"]');
  await comments.getByLabel("add a comment").fill("Taking this after standup.");
  await comments.getByRole("button", { name: "comment" }).click();
  await shown(comments.locator('[data-slot="comment"]'));
  await hold(800);
  await page.keyboard.press("Escape");

  // 3. The same board through the other views, by their keys.
  mark("views");
  await page.goto("/tasks");
  await shown(serverCard(page, "Today", "update the roadmap"));
  await blur(page);
  for (const [key, view] of [
    ["1", "table"],
    ["4", "calendar"],
    ["5", "timeline"],
    ["2", "kanban"],
  ] as const) {
    await pressViewKey(page, key, view);
    await hold(1100);
  }

  // 4. Habits: create and check off.
  mark("habits");
  await page.goto("/habits");
  await page.getByLabel("habit name").fill("walk 20 minutes");
  await page.getByRole("button", { name: "add habit" }).click();
  await page.getByRole("button", { name: "mark done" }).click();
  await hold(1200);

  // 5. Notes and markdown.
  mark("notes");
  await page.goto("/notes");
  await page.getByRole("button", { name: "new note" }).click();
  await page.waitForURL(/\/notes\/[^/]+$/u);
  await page.getByLabel("note title").fill("Board engine notes");
  await page
    .getByLabel("note body markdown")
    .fill("Five views, one source of truth:\n\n- kanban\n- table\n- grid\n- calendar\n- timeline");
  await page.getByRole("button", { name: "save" }).click();
  await shown(page.locator('[data-slot="note-status"]', { hasText: "saved" }));
  await hold(1000);

  // 6. Focus timer.
  mark("focus");
  await page.goto("/focus");
  await page.getByRole("button", { name: "start 25:00" }).click();
  await shown(page.locator('[data-slot="focus-status"]', { hasText: "session running" }));
  await hold(1600);

  // 7. The copilot proposes a write; nothing lands until it is approved.
  mark("copilot");
  await page.goto("/ai");
  const input = page.locator("#copilot-input");
  await shown(input);
  await input.fill("what can you do here?");
  await page.getByRole("button", { name: "send" }).click();
  await shown(page.getByText(/scripted/iu).first(), 30_000);
  await hold(1400);

  await input.fill('[[tool:create_card:{"title":"draft the release post"}]]');
  await page.getByRole("button", { name: "send" }).click();
  const proposed = page.locator('[data-slot="copilot-tool"]').last();
  await proposed.waitFor({ state: "attached", timeout: 30_000 });
  await proposed.waitFor({ state: "visible", timeout: 30_000 });
  await hold(1200);
  await page
    .getByRole("button", { name: /approve/iu })
    .last()
    .click();
  await proposed.waitFor({ state: "attached", timeout: 30_000 });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if ((await proposed.getAttribute("data-state")) === "output-available") break;
    await page.waitForTimeout(250);
  }
  await hold(1000);
  await page.goto("/tasks");
  await shown(serverCard(page, "Inbox", "draft the release post"));
  await hold(900);

  // 8. The command palette, searching the card that was just written.
  mark("palette");
  await blur(page);
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog");
  await shown(palette);
  await palette.getByPlaceholder(/search cards and boards/iu).type("release post", { delay: 30 });
  await shown(palette.getByRole("option", { name: /draft the release post/iu }));
  await hold(900);
  await palette
    .getByRole("option", { name: /draft the release post/iu })
    .first()
    .click();
  await page.waitForURL(/card=/u);
  await shown(page.getByRole("dialog"));
  await hold(700);
  await page.keyboard.press("Escape");

  // 9. Themes: the keyboard toggle, then a preset that changes the whole skin.
  mark("theme");
  const html = page.locator("html");
  const before = await html.getAttribute("data-color-mode");
  await blur(page);
  await page.keyboard.press("t");
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if ((await html.getAttribute("data-color-mode")) !== before) break;
    await page.waitForTimeout(100);
  }
  await hold(900);
  await page.goto("/settings/appearance");
  await shown(page.getByRole("radiogroup", { name: /preset/iu }));
  await page.getByRole("radio", { name: /paper/iu }).click();
  await hold(1400);

  // 10. Finale: the dashboard, now holding a day's real work.
  mark("dashboard");
  await page.goto("/dashboard");
  await page.waitForURL("**/dashboard");
  await hold(2600);
  await page.keyboard.press("Shift+/");
  await hold(1600);

  return chapters;
}

// --- Encoding -------------------------------------------------------------------

/**
 * GIF budget for a README: anything larger makes the page wait for the repo. The candidate ladders
 * down resolution and framerate until the file fits, so a longer or busier take cannot quietly ship a
 * 30 MB animation.
 */
const GIF_BUDGET_BYTES = 4_500_000;
const GIF_CANDIDATES = [
  { width: 1000, fps: 14 },
  { width: 900, fps: 12 },
  { width: 800, fps: 10 },
  { width: 700, fps: 8 },
] as const;

function encodeChapters(chapters: readonly Chapter[], gifChapter: string, duration: number): void {
  const webm = join(RAW_DIR, "take.webm");
  const mp4 = join(MEDIA_DIR, "demo.mp4");
  const gif = join(MEDIA_DIR, "demo.gif");
  const poster = join(MEDIA_DIR, "demo-poster.png");
  const env = { ...process.env, CI: "true" };

  run(
    "ffmpeg",
    [
      "-y",
      "-i",
      webm,
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "27",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-an",
      mp4,
    ],
    env,
  );

  const final = chapters.at(-1)?.at ?? 0;
  const start = chapters.find((chapter) => chapter.name === gifChapter)?.at ?? 0;
  const gifEnd = Math.min(start + duration, final);
  const posterAt = chapters.find((chapter) => chapter.name === "dashboard")?.at ?? final;

  let applied = GIF_CANDIDATES[0]!;
  for (const candidate of GIF_CANDIDATES) {
    applied = candidate;
    const filter = `fps=${String(candidate.fps)},scale=${String(candidate.width)}:-1:flags=lanczos`;
    run(
      "ffmpeg",
      [
        "-y",
        "-ss",
        String(start),
        "-to",
        String(gifEnd),
        "-i",
        mp4,
        "-vf",
        `${filter},palettegen=stats_mode=diff`,
        join(RAW_DIR, "palette.png"),
      ],
      env,
    );
    run(
      "ffmpeg",
      [
        "-y",
        "-ss",
        String(start),
        "-to",
        String(gifEnd),
        "-i",
        mp4,
        "-i",
        join(RAW_DIR, "palette.png"),
        "-lavfi",
        `${filter}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
        gif,
      ],
      env,
    );
    const bytes = statSync(gif).size;
    if (bytes <= GIF_BUDGET_BYTES) break;
    console.info(
      `[record] gif is ${(bytes / 1_000_000).toFixed(1)} MB at ${String(candidate.width)}px/${String(candidate.fps)}fps, stepping down`,
    );
  }

  run(
    "ffmpeg",
    [
      "-y",
      "-ss",
      String(posterAt),
      "-i",
      mp4,
      "-frames:v",
      "1",
      "-vf",
      "scale=1280:-1:flags=lanczos",
      poster,
    ],
    env,
  );

  const seconds = (gifEnd - start).toFixed(1);
  writeFileSync(
    join(MEDIA_DIR, "demo-chapters.json"),
    `${JSON.stringify(
      {
        generated_by: "scripts/record-demo.ts",
        recorded_at: new Date().toISOString().slice(0, 10),
        take_seconds: Number(final.toFixed(1)),
        gif: {
          chapter: applied === undefined ? gifChapter : gifChapter,
          start: Number(start.toFixed(1)),
          seconds: Number(seconds),
          width: applied.width,
          fps: applied.fps,
        },
        chapters,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

// --- Orchestration ----------------------------------------------------------------

async function main(): Promise<void> {
  const attach = hasFlag("attach");
  const skipBuild = hasFlag("skip-build");
  const gifChapter = process.env.DEMO_GIF_CHAPTER ?? process.argv[2] ?? "board";
  const gifSeconds = Number(process.env.DEMO_GIF_SECONDS ?? 14);

  rmSync(RAW_DIR, { recursive: true, force: true });
  mkdirSync(RAW_DIR, { recursive: true });

  const env = e2eEnv();
  env.BETTER_AUTH_URL = ORIGIN;
  env.NEXT_PUBLIC_APP_URL = ORIGIN;
  env.TRUSTED_ORIGINS = ORIGIN;

  if (!attach) {
    globalSetup();
    if (!skipBuild) run("pnpm", ["build"], env);
  }

  let server: ReturnType<typeof spawn> | null = null;
  if (!attach) {
    server = spawn("pnpm", ["exec", "next", "start", "-p", String(PORT)], {
      env,
      stdio: ["ignore", "ignore", "inherit"],
    });
    process.on("SIGINT", () => {
      server?.kill("SIGTERM");
      process.exit(130);
    });
  }

  console.info(`[record] waiting for ${ORIGIN}`);
  await waitForServer(server);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: ORIGIN,
    viewport: { width: WIDTH, height: HEIGHT },
    recordVideo: { dir: RAW_DIR, size: { width: WIDTH, height: HEIGHT } },
  });

  let exitCode = 0;
  let chapters: Chapter[] = [];
  try {
    chapters = await tour(context);
  } catch (error) {
    console.error("[record] the take failed:", error instanceof Error ? error.message : error);
    exitCode = 1;
  }

  const video = context.pages()[0]?.video();
  await context.close();
  await browser.close();
  server?.kill("SIGTERM");

  if (exitCode !== 0 || video === undefined || video === null) {
    console.error("[record] nothing was encoded; the raw capture is in docs/media/.raw");
    process.exit(exitCode === 0 ? 1 : exitCode);
  }

  const captured = await video.pathAsync();
  copyFileSync(captured, join(RAW_DIR, "take.webm"));
  console.info(
    `[record] captured ${readFileSync(join(RAW_DIR, "take.webm")).length > 0 ? join(RAW_DIR, "take.webm") : "nothing"}`,
  );

  encodeChapters(chapters, gifChapter, gifSeconds);
  console.info(
    `[record] take: ${String(chapters.at(-1)?.at.toFixed(1))}s · gif chapter "${gifChapter}"`,
  );
}

main().catch((error: unknown) => {
  console.error("[record] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
