import { expect, test } from "@playwright/test";

/**
 * The sweep's half of the skeleton contract. The rendered *shape* is covered deterministically in
 * `src/components/tui/skeleton.render.test.tsx`; this covers the one thing a jsdom test cannot see —
 * that the stylesheet actually reached the browser and resolves against theme tokens.
 *
 * Why not assert the loading boundary here: `loading.tsx` is a Suspense boundary, and catching it in
 * a transition means racing Next's router. Three attempts failed for instructive reasons, and the
 * third is worth recording because it is not obvious:
 *
 * 1. Holding the HTML **document** open on a cold load shows a blank page — there is nothing to
 *    paint yet, and a Suspense boundary only exists once a shell has shipped.
 * 2. Slowing the RSC **GET** (`?_rsc=…`, `RSC: 1`) slows the *prefetch*, which the click then serves
 *    from cache, so no boundary ever opens.
 * 3. Slowing every request to the path starves the route, because the click queues behind its own
 *    in-flight prefetch.
 *
 * The request the transition actually awaits is a `POST` with `accept: text/x-component`. Making that
 * test depend on holding it open would leave a 2.5 s race in the suite, and a race that passes on a
 * fast machine and fails on a slow one is worse than no test — so the boundary's *existence* is
 * pinned by the source-level sibling instead, and what is asserted here is the CSS.
 */
test.describe("the skeleton sweep", () => {
  test("reaches the browser and animates the vendored primitive", async ({ page }) => {
    await page.goto("/sign-in");

    // The rule targets the shadcn primitive by its data-slot, so any Skeleton on the page animates
    // without a class of its own. Read it from a live element rather than the stylesheet text.
    const sheet = await page.evaluate(() => {
      for (const style of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
          rules = style.cssRules;
        } catch {
          continue; // a cross-origin sheet we are not allowed to read
        }
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSKeyframesRule && rule.name === "skeleton-sweep") {
            return { found: true, frames: rule.cssRules.length };
          }
        }
      }
      return { found: false, frames: 0 };
    });
    expect(sheet.found).toBe(true);
    expect(sheet.frames).toBeGreaterThan(0);
  });

  test("is built from theme tokens, so it follows the active preset", async ({ page }) => {
    await page.goto("/sign-in");

    const sweep = await page.evaluate(() => {
      for (const style of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
          rules = style.cssRules;
        } catch {
          continue;
        }
        for (const rule of Array.from(rules)) {
          if (
            rule instanceof CSSKeyframesRule &&
            rule.name === "skeleton-sweep" &&
            rule instanceof CSSKeyframesRule
          ) {
            // Walk every declaration in every frame looking for a baked-in colour.
            const text: string[] = [];
            for (const frame of Array.from(rule.cssRules) as CSSKeyframeRule[]) {
              for (const item of Array.from(frame.style)) text.push(item);
            }
            return { colors: text };
          }
        }
      }
      return { colors: [] as string[] };
    });

    // A hardcoded colour would be invisible to the high-contrast preset and to the axe sweep —
    // exactly how ADR-098's palettes were missed before.
    for (const declaration of sweep.colors) {
      expect(declaration).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/iu);
    }
  });

  test("neutralises the vendored pulse instead of stacking a second animation on it", async ({
    page,
  }) => {
    await page.goto("/sign-in");

    // shadcn ships `animate-pulse`. A sweep on top of a pulse is a strobe, and the axe sweep cannot
    // see either — so the override is asserted to exist rather than assumed.
    const rules = await page.evaluate(() => {
      const found: Array<{ selector: string; animationName: string; overflow: string }> = [];
      for (const style of Array.from(document.styleSheets)) {
        let sheet: CSSRuleList;
        try {
          sheet = style.cssRules;
        } catch {
          continue;
        }
        for (const rule of Array.from(sheet)) {
          if (rule instanceof CSSStyleRule && rule.selectorText?.includes('data-slot="skeleton"')) {
            // Read the longhands, not `cssText`: the `animation` shorthand serialises expanded
            // ("auto ease 0s 1 normal none running none"), so matching the text for "none" is
            // matching a spelling that does not occur.
            found.push({
              selector: rule.selectorText,
              animationName: rule.style.animationName,
              overflow: rule.style.overflow,
            });
          }
        }
      }
      return found;
    });

    expect(rules.length).toBeGreaterThan(0);
    // The element-level rule both stops the pulse and clips the sweep.
    const element = rules.find((rule) => rule.selector === '[data-slot="skeleton"]');
    expect(element?.animationName).toBe("none");
    // The clip is load-bearing: without it the sweep paints over the panel frame.
    expect(element?.overflow).toBe("hidden");

    // And the sweep is attached to the pseudo-element, not the box, so it cannot shift layout.
    const sweep = rules.find((rule) => rule.selector.includes("::after"));
    expect(sweep).toBeDefined();
  });
});
