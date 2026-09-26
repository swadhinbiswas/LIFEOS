import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * The shared control vocabulary (ADR-117). Source-level because the compiler cannot see a border
 * and jsdom has no cascade, so a rendered test would pass for the regressions below.
 */

const tui = (name: string) => readFileSync(`src/components/tui/${name}`, "utf8");
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
    // A local copy is how the five drifted in the first place.
    for (const file of ["board-toolbar", "inbox-list", "saved-views", "board-utils"]) {
      expect(board(`${file}.tsx`), file).not.toMatch(/const control =/u);
    }
  });
});
