import { mkdir, writeFile } from "node:fs/promises";

import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * The themed scrollbar, **measured** (ADR-129).
 *
 * This spec exists because of a limit I hit twice and named twice: headless Chromium draws
 * *overlay* scrollbars, which occupy no space, so the gutter is 0, nothing is painted, and a
 * screenshot of a "themed scrollbar" is a screenshot of nothing. I wrote that down as an honest
 * limit — twice — and it was an unfixed bug wearing a suit.
 *
 * Four Chromium flags were tried against a control element requesting a 40px custom scrollbar:
 * `--disable-features=OverlayScrollbar`, `--force-renderer-accessibility`, and both together. All
 * four measured 0. The same page launched **headed** measured exactly 40, with no flag at all. So
 * the fix was a display, not a flag, and it lives in `playwright.visual.ts`.
 *
 * Which is how a real defect got caught: once the gutter could be measured at all,
 * `tests/e2e/scrollbar.spec.ts` failed, because `scrollbar-width: thin` tells the UA to use
 * *standard* scrollbar rendering, and standard rendering means the entire `::-webkit-scrollbar` block
 * is ignored. The themed scrollbar had therefore never applied in Chromium — the browser that
 * reported the ugly default. Neither a screenshot nor a headless run could have found it.
 *
 * The probe below is what makes the spec safe in the ordinary headless sweep: it measures a
 * deliberately oversized scrollbar on a throwaway element, and skips with the reason and the command
 * to run when the environment cannot answer. A skip that says why is honest; a skip that hides is
 * the thing I am trying to stop doing.
 */

/** What `.scroll-tui` declares: a 10px gutter carrying a 4px thumb. */
const TUI_GUTTER = 10;
/** The platform default the report was about: 15px, with arrow buttons. */
const PLATFORM_GUTTER = 15;

/**
 * Whether this browser can measure a custom scrollbar at all, asked of a throwaway element rather
 * than of the app. 40px is chosen to be unmistakable — 10px could plausibly be a rounding artefact.
 */
async function canMeasureCustomScrollbars(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;top:-9999px;width:200px;height:80px;overflow:scroll";
    const inner = document.createElement("div");
    inner.style.cssText = "width:1px;height:400px";
    probe.append(inner);
    const style = document.createElement("style");
    style.textContent = "#__sb_probe::-webkit-scrollbar{width:40px;height:40px}";
    probe.id = "__sb_probe";
    document.head.append(style);
    document.body.append(probe);
    const measured = probe.offsetWidth - probe.clientWidth;
    probe.remove();
    style.remove();
    return measured >= 40;
  });
}

/** Save a screenshot somewhere a person will actually find it, and attach it for the report. */
const capture = async (page: Page, testInfo: TestInfo, name: string) => {
  const body = await page.screenshot();
  await testInfo.attach(name, { body, contentType: "image/png" });
  await mkdir("visual-shots", { recursive: true });
  await writeFile(`visual-shots/${name}.png`, body);
};

const skipUnlessMeasurable = async (page: Page) => {
  const measurable = await canMeasureCustomScrollbars(page);
  test.skip(
    !measurable,
    "this browser draws overlay scrollbars, so a custom gutter cannot be measured. " +
      "run `pnpm e2e:visual` (headed, needs a display) to check this.",
  );
};

/** A region that is actually overflowing, which is the only case where a gutter is drawn at all. */
const overflowing = async (
  locator: Locator,
): Promise<{
  gutter: number;
  overflows: boolean;
  scrollbarWidth: string;
  /** Reported in a failure message, so a wrong box is diagnosable without a print statement. */
  content: number;
  box: number;
}> =>
  locator.evaluate((el) => {
    const node = el as HTMLElement;
    return {
      gutter: node.offsetWidth - node.clientWidth,
      overflows: node.scrollHeight > node.clientHeight,
      // Kept in the payload because it is the thing that goes wrong silently: when the standard
      // property is anything but `auto`, the browser ignores `::-webkit-scrollbar` entirely.
      scrollbarWidth: getComputedStyle(node).scrollbarWidth,
      content: node.scrollHeight,
      box: node.clientHeight,
    };
  });

test.describe("themed scrollbar (adr-129)", () => {
  test.setTimeout(240_000);

  test("the sidebar nav draws the theme's gutter, not the platform's", async ({
    page,
  }, testInfo) => {
    const email = uniqueEmail("sb-nav");
    await createVerifiedUser(page, email);
    await signIn(page, email);
    // Short on purpose, and set here rather than in the config: `devices["Desktop Chrome"]` carries
    // its own 1280x720 viewport and a project's `use` beats the top-level one, so a viewport set in
    // `playwright.visual.ts` is silently ignored. The nav is 25+ destinations and only overflows on
    // a genuinely short window — the case the report was a screenshot of.
    await page.setViewportSize({ width: 1280, height: 460 });
    await page.goto("/dashboard");
    const nav = page.locator('[data-slot="app-sidebar-nav"]');
    await nav.waitFor({ timeout: 30_000 });

    // In the default flow layout the nav is a flex item with no height constraint, so it grows to
    // its content (989px) and the *page* scrolls instead — measured, not assumed. The mode in the
    // report is `full`, where the aside is `position: fixed; top: 0; bottom: 0` and the nav is
    // therefore viewport-height and does scroll. So cycle the real header control to that mode rather
    // than poking the attribute, which would test a state a person cannot reach.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if ((await page.locator("html").getAttribute("data-sidebar-mode")) === "full") break;
      await page
        .getByRole("button", { name: /sidebar/i })
        .first()
        .click();
      await page.waitForTimeout(400);
    }
    expect(
      await page.locator("html").getAttribute("data-sidebar-mode"),
      "could not reach the sidebar mode the report was taken in",
    ).toBe("full");
    await page.waitForTimeout(600);
    await skipUnlessMeasurable(page);

    const info = await overflowing(nav);
    expect(
      info.overflows,
      `the nav must overflow for a gutter to mean anything (content ${info.content}px in a ${info.box}px box)`,
    ).toBe(true);
    // The point of the whole exercise: the gutter is the width the theme asked for, and is not the
    // platform's 15px widget. In Chromium this number comes from `::-webkit-scrollbar` and in Firefox
    // from `scrollbar-width: thin` — the engine differs, the observable does not, so the observable
    // is what gets asserted. An earlier version asserted the standard property instead, which
    // described the broken CSS: setting it to `thin` is exactly what made Chromium discard the whole
    // pseudo-element block.
    expect(info.gutter).toBe(TUI_GUTTER);
    expect(info.gutter).not.toBe(PLATFORM_GUTTER);

    // Two destinations on purpose. The attachment is what the html report knows about; the file is
    // what a person looks at after a deliberate local run, because `test-results/` is cleared at the
    // start of every run and the `list` reporter discards attachments for passing tests.
    await capture(page, testInfo, "sidebar-gutter");
  });

  test("the applications table draws a themed horizontal gutter and can be dragged", async ({
    page,
  }, testInfo) => {
    const email = uniqueEmail("sb-table");
    await createVerifiedUser(page, email);
    await signIn(page, email);

    const jobs: Array<[string, string]> = [
      ["Senior Data Engineer", "Northwind Analytics"],
      ["Platform Engineer", "Harbour Labs"],
      ["ML Infrastructure Engineer", "Lumen AI"],
    ];
    for (const [title, company] of jobs) {
      await page.goto("/career/jobs");
      await page.getByLabel("job title").fill(title);
      await page.getByLabel("company").fill(company);
      await page.getByRole("button", { name: "add job" }).click();
      await page.waitForTimeout(1100);
    }

    await page.goto("/career/jobs?view=database");
    const region = page.locator('[data-slot="table-container"]').first();
    await region.waitFor({ timeout: 30_000 });
    await page.waitForTimeout(600);
    await skipUnlessMeasurable(page);

    const height = await region.evaluate((el) => (el as HTMLElement).offsetHeight);
    const client = await region.evaluate((el) => el.clientHeight);
    expect(
      height - client,
      "the table's horizontal gutter must be the theme's, not the platform's",
    ).toBe(TUI_GUTTER);

    // And the bar is not decoration: the region scrolls, and it scrolls because a person dragged it.
    const scroll = await region.evaluate((el) => {
      const node = el as HTMLElement;
      return { canScroll: node.scrollWidth > node.clientWidth, before: node.scrollLeft };
    });
    expect(scroll.canScroll).toBe(true);
    expect(scroll.before).toBe(0);

    await region.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
    await page.waitForTimeout(400);
    const after = await region.evaluate((el) => Math.round(el.scrollLeft));
    expect(after, "the region must actually move").toBeGreaterThan(0);

    await capture(page, testInfo, "table-gutter");
  });

  test("a region that fits is left with no gutter at all", async ({ page }) => {
    const email = uniqueEmail("sb-fit");
    await createVerifiedUser(page, email);
    await signIn(page, email);
    // Tall window: the same nav now fits, and a browser only paints a gutter when there is
    // something to scroll to. Pinning this because it is the claim the ADR makes — a themed bar
    // costs a nav that fits nothing at all.
    await page.setViewportSize({ width: 1280, height: 1400 });
    await page.goto("/dashboard");
    const nav = page.locator('[data-slot="app-sidebar-nav"]');
    await nav.waitFor({ timeout: 30_000 });
    await page.waitForTimeout(800);

    const measured = await nav.evaluate((el) => {
      const node = el as HTMLElement;
      return {
        gutter: node.offsetWidth - node.clientWidth,
        canScroll: node.scrollHeight > node.clientHeight,
      };
    });
    expect(measured.canScroll).toBe(false);
    expect(measured.gutter).toBe(0);
  });
});
