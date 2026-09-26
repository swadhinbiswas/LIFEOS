import { existsSync, readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { basename, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Skeletons are a visual contract, and nothing in the compiler or the test runner can see it. Three
 * of these rules are there because each was broken at some point:
 *
 * - A skeleton that is not built on the shadcn `Skeleton` has been hand-written, and spec §7.1 says
 *   run the CLI rather than hand-write primitives.
 * - A raw `animate-pulse` ignores `prefers-reduced-motion`, because Tailwind does not disable
 *   animations on its own. The sweep has to be CSS to be guarded.
 * - A route with no `loading.tsx` silently inherits the group fallback, which is shaped like
 *   nothing in particular — the state this whole change set was made to remove.
 */

const pageFiles = globSync("src/app/**/page.tsx");
const loadingFiles = globSync("src/app/**/loading.tsx");

describe("loading skeletons (spec 13 reliability)", () => {
  it("finds the routes and the skeletons to check", () => {
    expect(pageFiles.length).toBeGreaterThan(30);
    expect(loadingFiles.length).toBeGreaterThan(10);
  });

  it("gives every signed-in route its own skeleton, or a reason not to", () => {
    // The public surfaces genuinely have no slow server work worth a skeleton, and the `(app)`
    // group has a fallback for anything missed. Everything inside `(app)` should have its own.
    const withOwn = new Set(loadingFiles.map((file) => file.replace(/loading\.tsx$/u, "page.tsx")));
    const missing = pageFiles.filter((file) => {
      if (!file.includes("/(app)/")) return false;
      if (file === "src/app/(app)/page.tsx") return false; // the group's own root, uses loading.tsx
      return !withOwn.has(file);
    });
    expect(missing).toEqual([]);
  });

  it("has no skeleton without a page to stand in for", () => {
    // A `loading.tsx` in a directory with no `page.tsx` is a phantom route: dead code that still
    // looks deliberate. One was created here by a path typo and only noticed because `git status`
    // listed an unexpected directory.
    //
    // `existsSync` rather than a glob, because `[id]` is a character class in glob syntax and would
    // silently match nothing — the check has to work on the dynamic segments it is protecting.
    // The `(app)` group's own `loading.tsx` is the one legitimate fallback with no sibling page.
    const orphans = loadingFiles.filter((file) => {
      if (file === "src/app/(app)/loading.tsx") return false;
      const dir = file.slice(0, file.lastIndexOf("/"));
      return !existsSync(`${dir}/page.tsx`);
    });
    expect(orphans).toEqual([]);
  });

  it("builds every skeleton on the shadcn primitive or the shared TUI vocabulary", () => {
    const allowed = /@\/components\/(ui|tui)\/skeleton/u;
    const offenders: string[] = [];
    for (const file of loadingFiles) {
      const source = readFileSync(file, "utf8");
      // No raw <div class="... animate-pulse"> and no hand-rolled blocks: the only drawable
      // elements come from the two skeleton modules.
      if (/animate-pulse/u.test(source)) offenders.push(`${file}: animate-pulse`);
      if (!/Skeleton/u.test(source)) offenders.push(`${file}: draws no skeleton`);
      if (
        /from "@\/components\/ui\/skeleton"/u.test(source) === false &&
        allowed.test(source) === false
      ) {
        offenders.push(`${file}: imports neither skeleton module`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never animates a skeleton in JSX, so reduced motion can switch it off", () => {
    // The motion lives in globals.css under a `prefers-reduced-motion` guard; an inline animation
    // class would bypass that guard entirely.
    const offenders = loadingFiles.filter((file) =>
      /animation:|animate-\[(?!none)/u.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("guards the sweep for reduced motion and keeps the vendored primitive untouched", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/@keyframes skeleton-sweep/u);
    // The guard has to sit in the same file, because that is what actually wins.
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/\[data-slot="skeleton"\]::after\s*\{[^}]*animation: none/u);

    // shadcn's Skeleton ships `animate-pulse`; the re-skin has to neutralise it rather than
    // assume a future upgrade removes it.
    const primitive = readFileSync("src/components/ui/skeleton.tsx", "utf8");
    expect(primitive).toMatch(/animate-pulse/u);
    expect(css).toMatch(/\[data-slot="skeleton"\]\s*\{[^}]*animation: none/u);
  });

  it("keeps the sweep built from theme tokens, so every preset gets it", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const block = css.slice(css.indexOf("@keyframes skeleton-sweep"));
    // No raw hex or rgb in the sweep: a hardcoded colour is invisible to the high-contrast preset
    // and to the axe sweep, which is exactly how ADR-098's palettes got missed before.
    expect(block.slice(0, 900)).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/iu);
    expect(block).toMatch(/var\(--muted-foreground\)/u);
    expect(block).toMatch(/var\(--foreground\)/u);
  });

  it("gives every route a unique slot, so one can be told from another", () => {
    // A generated batch pasted one `data-slot` into five settings sections, so the attribute could
    // not identify which page was loading — the exact thing it exists for. The assertion is
    // uniqueness, not just presence, because presence alone let that through.
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const file of loadingFiles) {
      const slot = /data-slot="([^"]+)"/u.exec(readFileSync(file, "utf8"))?.[1];
      if (slot === undefined) continue;
      const previous = seen.get(slot);
      if (previous !== undefined) clashes.push(`${slot}: ${previous} and ${file}`);
      else seen.set(slot, file);
    }
    expect(clashes).toEqual([]);
  });

  it("names each skeleton so a reader can tell which page it belongs to", () => {
    const offenders = loadingFiles.filter(
      (file) => !/data-slot="loading/u.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("gives the panel skeleton the same chip geometry as the real panel", () => {
    // The chip overlapping the frame is what stops a skeleton from looking like a re-layout when
    // the data lands; if either side moves, the swap is visible.
    const panel = readFileSync("src/components/ui/../tui/panel.tsx", "utf8");
    const skeleton = readFileSync("src/components/tui/skeleton.tsx", "utf8");
    for (const source of [panel, skeleton]) {
      expect(source).toMatch(/top-0 left-3/u);
      expect(source).toMatch(/-translate-y-1\/2/u);
      expect(source).toMatch(/bg-card px-2/u);
    }
  });

  it("keeps the auth skeletons centred, matching the pages they stand in for", () => {
    // An auth page has no app chrome, so a full-width skeleton would misdescribe the layout.
    for (const route of ["sign-in", "sign-up"]) {
      const file = `src/app/(auth)/${route}/loading.tsx`;
      expect(readFileSync(file, "utf8"), route).toMatch(/min-h-svh/u);
    }
  });

  it("gives every loading state the heading level the page it replaces has", () => {
    // The real auth page's heading is its panel title at `titleAs="h1"`, and `PageHeader` renders an
    // `h1` too. A loading state with no top level fails `page-has-heading-one` on any client-side
    // entry — a failure the cold-document a11y sweep never reaches, because it only ever loads these
    // routes as documents.
    const without = loadingFiles.filter((file) => {
      const source = readFileSync(file, "utf8");
      return !/<h1[\s>]/u.test(source) && !/PageHeaderSkeleton/u.test(source);
    });
    expect(without).toEqual([]);
  });

  it("documents every new route file with the reason it looks the way it does", () => {
    const undocumented = loadingFiles.filter((file) => {
      const source = readFileSync(file, "utf8");
      return !/\/\*\*/u.test(source.slice(0, 400));
    });
    expect(undocumented).toEqual([]);
  });

  it("keeps each skeleton named after its route", () => {
    for (const file of loadingFiles) {
      const slot = /data-slot="([^"]+)"/u.exec(readFileSync(file, "utf8"))?.[1] ?? "";
      if (file === "src/app/(app)/loading.tsx") continue; // the group fallback, named `loading`
      expect(slot, relative(".", file)).not.toBe("");
    }
    expect(basename("src/app/(app)/loading.tsx")).toBe("loading.tsx");
  });
});
