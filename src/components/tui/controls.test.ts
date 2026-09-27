import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * The shared control vocabulary (ADR-117). Source-level because the compiler cannot see a border
 * and jsdom has no cascade, so a rendered test would pass for the regressions below.
 */

const tui = (name: string) => readFileSync(`src/components/tui/${name}`, "utf8");
const read2 = (path: string) => readFileSync(path, "utf8");

/** The source of one `export const`, up to the next one. */
const tier = (name: string): string => {
  const source = tui("controls.tsx");
  const start = source.indexOf(`export const ${name}`);
  const next = source.indexOf("export const ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
};
const board = (name: string) => readFileSync(`src/app/(app)/_components/board/${name}`, "utf8");

/** Unprefixed class tokens between two markers. A `:` prefix is a Tailwind variant, so
 *  "is there a border at rest?" is answered by the tokens that have none. */
const tokens = (source: string, from: string, to: string): string[] => {
  const start = source.indexOf(from);
  return [...source.slice(start, source.indexOf(to, start + 1)).matchAll(/"([^"]*)"/gu)].flatMap(
    (match) => match[1]!.split(/\s+/u),
  );
};

const ghost = () =>
  tokens(tui("controls.tsx"), "export const controlGhost", "export const chipState");
const base = () => ghost().filter((token) => !token.includes(":"));

describe("control vocabulary (adr-117)", () => {
  it("gives a ghost no visible border at rest", () => {
    expect(base().filter((t) => t.startsWith("border"))).toEqual(["border", "border-transparent"]);
  });

  it("declares the display its call sites' layout utilities require", () => {
    // `flex-1`, `justify-start`, `gap-2` and `ml-auto` are flex-only, and the shell's footer rows
    // passed all four to a base that declared no display at all — so the label, the key caps and the
    // unread count rendered flush ("searchCtrlK", "notifications2"). The vocabulary owns the display;
    // the call site owns only what it changes.
    expect(base()).toContain("inline-flex");
    expect(base()).toContain("items-center");
  });

  it("reserves the border width so hover cannot shift siblings", () => {
    // `hover:border` on a borderless element grows the box 2px and nudges everything to its right.
    // The base already carries the width, so hover only has to recolour it …
    expect(base()).toContain("border");
    // … and no state may drop the width, which would shrink the box instead.
    expect(ghost().join(" ")).not.toMatch(/border-0/);
  });

  it("raises the ghost on hover and on focus-visible alike", () => {
    const styles = ghost().join(" ");
    expect(styles).toContain("hover:border-border");
    expect(styles).toContain("focus-visible:border-ring");
  });

  it("keeps a disabled ghost undecorated", () => {
    expect(ghost().join(" ")).toContain("disabled:hover:border-transparent");
  });

  it("makes an inactive chip a label", () => {
    const chip = tui("controls.tsx").slice(tui("controls.tsx").indexOf("export const chipState"));
    expect(chip).toContain("bg-primary text-primary-foreground");
    const [, inactive] = chip.match(/: "([^"]*)"/u) ?? [];
    expect(inactive).toBeDefined();
    expect(inactive).not.toMatch(/border/u);
  });

  it("divides groups with a border, not a glyph", () => {
    // A `│` left dangling at the end of a wrapped line; a border belongs to its group.
    const group = tui("controls.tsx").slice(tui("controls.tsx").indexOf("ToolbarGroup"));
    expect(group).toContain("border-l border-border pl-2");
    expect(group).not.toMatch(/[\u2500-\u257F]/u);
  });

  it("floors every tier at 24px, the wcag minimum", () => {
    // Measured: 86 of 445 targets across ten pages were 19px, all from one chip geometry.
    // `min-h-6` is 24px; the field tier is deliberately `min-h-7` (28px, the app's own §4.4 floor).
    // The invariant is the number, not the literal class.
    for (const name of ["controlGhost", "chipState", "controlBoxed", "controlField"]) {
      const steps = Number(/min-h-(\d)/u.exec(tier(name))?.[1] ?? 0);
      expect(steps, `${name} declares no min-height`).toBeGreaterThanOrEqual(6);
    }
  });

  it("is defined once, and used by both features", () => {
    for (const file of [
      "board-toolbar",
      "board-utils",
      "board-view",
      "saved-views",
      "inbox-list",
    ]) {
      expect(board(`${file}.tsx`), file).toContain("tui/controls");
    }
    expect(board("inbox-list.tsx")).toMatch(/className=\{controlGhost\}/u);
    // A local copy is how the five drifted in the first place, and the ninth (`field`) is why
    // every form input in the app was 22px.
    for (const file of ["board-toolbar", "inbox-list", "saved-views", "board-utils", "card-tile"]) {
      expect(board(`${file}.tsx`), file).not.toMatch(/const control =/u);
    }
    // The quote matters: a `const field = "..."` is a class string, while `const field = "stage"`
    // in a comparator is a column name. Matching the bare name flagged both.
    const forms = globSync("src/app/**/[a-z]*.tsx").filter((f) =>
      /const field = "/u.test(read2(f)),
    );
    expect(forms, "files still declaring their own field class").toEqual([]);
  });
});
