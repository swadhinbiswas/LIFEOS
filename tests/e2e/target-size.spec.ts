import { expect, test } from "@playwright/test";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

/**
 * Target size, measured (spec §4.4, WCAG 2.2 SC 2.5.8).
 *
 * The app's own floor is 28px; WCAG 2.2 AA asks for 24px. This exists because the floor was
 * written down and then not met: a measurement across ten pages found 86 of 445 interactive
 * targets under 24px, every one of them the same 19px tall — the `py-0.5 text-[10px]` chip. A
 * reviewer reading the CSS would not have caught it, because the number that matters is the
 * rendered box, and nothing in the type system or the compiler produces a rendered box.
 *
 * `axe` cannot catch this either: SC 2.5.8 is not an automated check, which is exactly why it
 * regressed. So it is measured here, in a real browser, against the same pages that were worst.
 *
 * Two exemptions, both from the spec:
 * - **Inline** targets constrained by the line-height of surrounding text (a link inside a
 *   sentence), which is why this looks at standalone controls in a control row.
 * - **Zero-size** elements, which are `hidden` and cannot be targeted at all.
 */
const PAGES = [
  "/dashboard",
  "/tasks",
  "/inbox",
  "/notes",
  "/calendar",
  "/habits",
  "/goals",
  "/career/jobs",
  "/focus",
  "/finance",
  // Settings is where the raw 13x13 checkboxes lived, so a guard that skipped it would have
  // reported "clean" while the defect was still on screen. The hole was found by grepping for
  // `type="checkbox"` after the first run passed, not by the test.
  "/settings/integrations",
  "/settings/ai",
];

/** 24 CSS px: WCAG 2.2 SC 2.5.8, level AA. */
const WCAG_MIN = 24;

test.describe("target size (wcag 2.2 sc 2.5.8)", () => {
  test.setTimeout(180_000);

  for (const path of PAGES) {
    test(`${path}: interactive controls are at least ${WCAG_MIN}px tall`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      const email = uniqueEmail(`target-${path.replace(/\W+/gu, "")}`);
      await createVerifiedUser(page, email);
      await signIn(page, email);
      await page.goto(path);
      await page.waitForLoadState("networkidle").catch(() => {});

      const undersized = await page.evaluate((min) => {
        const selector =
          'button, a[href], [role="checkbox"], [role="switch"], [role="radio"], select, input:not([type="hidden"])';
        const found: Array<{ tag: string; name: string; w: number; h: number }> = [];
        for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
          const box = el.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) continue;
          const style = getComputedStyle(el);
          if (style.visibility === "hidden" || style.display === "none") continue;
          // Inline exception: WCAG exempts a target whose box is set by the line-height of the
          // text it sits in. `display: inline` *is* that condition, so it is the whole test — an
          // earlier version also required the element to sit inside a p/li/span, which exempted
          // any inline link anywhere in the app and would have hidden real violations. A control
          // that wants a box sets `inline-flex`, and is measured.
          if (style.display === "inline") continue;
          if (box.height < min) {
            found.push({
              tag: el.tagName.toLowerCase(),
              name: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30),
              w: Math.round(box.width),
              h: Math.round(box.height),
            });
          }
        }
        return found;
      }, WCAG_MIN);

      expect(
        undersized,
        `undersized on ${path}: ` +
          undersized.map((u) => `${u.tag} "${u.name}" ${u.w}x${u.h}`).join(", "),
      ).toEqual([]);
    });
  }
});
