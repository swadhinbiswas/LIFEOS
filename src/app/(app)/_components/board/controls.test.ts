import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * The board's two-tier control vocabulary (ADR-117).
 *
 * This is a visual contract, so it is asserted at the source level: the compiler cannot tell that a
 * ghost control grew a permanent border, and jsdom has no cascade, so a rendered-DOM test would
 * pass for the exact regression this file exists to catch. What is checkable here is the *intent* —
 * that the class strings still say what the ADR says they say, and that the four call sites still
 * reach for the shared definitions instead of re-declaring their own.
 *
 * The rule that matters most is the hover/focus symmetry. A control that reveals its border only
 * on `hover:` is invisible to a keyboard user and invisible on touch, and this app is keyboard-first
 * (spec §4.4), so a ghost that lost its `focus-visible:` twin would be a real accessibility
 * regression wearing a styling change as a disguise.
 */

const read = (name: string) => readFileSync(`src/app/(app)/_components/board/${name}`, "utf8");

/**
 * Every unprefixed (non-variant) class token between two markers in a source file.
 *
 * Tailwind spells a state as a prefix — `hover:border`, `focus-visible:border` — so "is there a
 * border at rest?" is answered by the tokens that have *no* prefix. Anything that reached for a
 * substring test here would match the variants too and quietly assert nothing.
 */
const classTokens = (source: string, from: string, to: string): string[] => {
  const block = source.slice(source.indexOf(from), source.indexOf(to, source.indexOf(from) + 1));
  return [...block.matchAll(/"([^"]*)"/gu)].flatMap((match) => match[1]!.split(/\s+/u));
};

const controls = read("controls.tsx");
const toolbar = read("board-toolbar.tsx");
const view = read("board-view.tsx");
const utils = read("board-utils.tsx");
const savedViews = read("saved-views.tsx");
const planMyDay = read("plan-my-day.tsx");

describe("board control vocabulary (adr-117)", () => {
  it("defines the two tiers in one place", () => {
    expect(controls).toContain("export const controlGhost");
    expect(controls).toContain("export const controlBoxed");
    expect(controls).toContain("export const chipState");
  });

  it("keeps a ghost control free of visible ink at rest", () => {
    // Matched per class token rather than by substring, because a naive `/\bborder\b/` also
    // matches `hover:border` and would pass a control that boxes itself on hover.
    const tokens = classTokens(controls, "export const controlGhost", "export const chipState");
    const borders = tokens.filter((token) => !token.includes(":") && token.startsWith("border"));
    // The only unprefixed border is the transparent one that reserves the geometry.
    expect(borders).toEqual(["border", "border-transparent"]);
  });

  it("reserves the ghost's border width so hovering cannot shift its siblings", () => {
    // The bug this replaced: `hover:border` on a borderless element grew the box by 2px and nudged
    // every control to its right, in a toolbar where the controls are 4px apart. The fix is a
    // transparent border at rest, so hover changes colour and only colour.
    const tokens = classTokens(controls, "export const controlGhost", "export const chipState");
    const base = tokens.filter((token) => !token.includes(":"));
    expect(base).toContain("border");
    // Nothing in any variant may *add* a border width that the base does not already have.
    for (const token of tokens.filter((entry) => entry.includes(":"))) {
      const [state, utility] = token.split(":");
      if (utility?.startsWith("border") && !utility.includes("-")) {
        expect(`${state}:${utility}`, `hover adds border width`).toBe("noop:border");
      }
    }
  });

  it("raises the ghost's border on hover AND on focus-visible", () => {
    // Asymmetric hover-only reveal is the failure mode: a mouse user sees a control appear and
    // concludes the page is fine, while a keyboard user sees a bare label with no affordance.
    const ghost = controls.slice(
      controls.indexOf("export const controlGhost"),
      controls.indexOf("export const chipState"),
    );
    expect(ghost).toContain("hover:border");
    expect(ghost).toContain("focus-visible:border");
    expect(ghost).toContain("focus-visible:outline");
  });

  it("keeps a disabled ghost from drawing a border on hover", () => {
    // Load-bearing: undo and redo are disabled most of the time, so without this they would be the
    // only permanently boxed things left on the board — the opposite of the change.
    const ghost = controls.slice(
      controls.indexOf("export const controlGhost"),
      controls.indexOf("export const chipState"),
    );
    expect(ghost).toContain("disabled:hover:border-transparent");
  });

  it("makes an inactive filter chip a label rather than a box", () => {
    // Five always-on bordered chips for filters that are mostly off was the loudest thing on the
    // page. Off must carry no border; on keeps the primary fill so state is still a colour.
    const chip = controls.slice(controls.indexOf("export const chipState"));
    const [, off] = chip.split("?")[1]?.split(":") ?? [];
    expect(chip).toContain("bg-primary text-primary-foreground");
    expect(off).toBeDefined();
    expect(off).not.toMatch(/border/u);
  });

  it("stops the toolbar re-declaring its own chip class", () => {
    // The bug that produced twenty boxes: four files each had their own copy of the treatment, and
    // they drifted. One definition, referenced everywhere.
    expect(toolbar).toContain('from "./controls"');
    expect(toolbar).not.toMatch(/const chip = /u);
    expect(view).not.toMatch(/rounded-\[var\(--radius\)\] border border-border/u);
  });

  it("folds the board's utility rows into the toolbar bar", () => {
    // Three stacked full-width rows read as one mass. `BoardUtils` and the undo/redo pair now sit
    // inside the same flex row as the filters, between hairline rules.
    const utilitiesAt = view.indexOf("<BoardUtils");
    const undoAt = view.indexOf('data-slot="undo"');
    const rowOpen = view.lastIndexOf("flex flex-wrap items-center", utilitiesAt);
    expect(rowOpen).toBeGreaterThan(-1);
    expect(undoAt).toBeGreaterThan(rowOpen);
    expect(utilitiesAt).toBeGreaterThan(rowOpen);
    expect(view).toContain("<ToolbarGroup ruled>");
    // Both trailing groups carry a rule, so a wrap cannot make one look like a continuation.
    expect(utils).toContain("<ToolbarGroup ruled>");
  });

  it("draws the group rule as a border, not a glyph, so a wrap cannot orphan it", () => {
    // The pipe was screenshotted at 1000 px, where the bar wraps: it was stranded at the end of a
    // line with its group on the next one and read as a rendering bug. A border belongs to the
    // group, so the two always move together and there is no state where they come apart.
    const group = controls.slice(controls.indexOf("export function ToolbarGroup"));
    expect(group).toContain("border-l border-border pl-2");
    expect(group).not.toContain("\u2502");
    expect(view).not.toContain("ToolbarDivider");
    expect(planMyDay).not.toContain("ToolbarDivider");
  });

  it("keeps the boxed tier for the trash panel, which is a deliberate surface", () => {
    // "Delete forever" should not look like a label, and the trash panel is only visible because
    // the user opened it. Both the per-card actions and purge use the boxed tier.
    expect(utils).toContain("controlBoxed");
    expect(utils.match(/controlBoxed/gu)?.length).toBeGreaterThanOrEqual(3);
  });

  it("marks the destructive trash actions so hover says what the click does", () => {
    expect(utils).toContain("hover:text-destructive");
    expect(savedViews).toContain("hover:text-destructive");
  });

  it("separates the plan-my-day counts so four numbers stop reading as one sentence", () => {
    // The run-on string was `OVERVIEW 0 DUE TODAY 0 INBOX 1 PLANNED 65 MIN`: a `dl` with `gap-4`
    // and nothing that reads as a division. Three dividers for four counts.
    expect(planMyDay).toContain('data-slot="plan-counts"');
    expect(planMyDay.match(/<ToolbarGroup ruled/gu)).toHaveLength(3);
  });

  it("colours only the count that means something is wrong", () => {
    // Overdue is the one number worth interrupting for. The rest stay muted, so a warning-coloured
    // figure on this panel is always worth looking at.
    const counts = planMyDay.slice(
      planMyDay.indexOf('data-slot="plan-counts"'),
      planMyDay.indexOf("</dl>"),
    );
    expect(counts).toContain("text-warning");
    expect(counts.match(/text-warning/gu)).toHaveLength(1);
  });

  it("keeps the rules out of the accessibility tree by being borders", () => {
    // A screen reader should hear "overdue, due today" — not "overdue, vertical bar, due today".
    // Asserted as the absence of a text glyph rather than the presence of `aria-hidden`, because a
    // CSS border generates no accessible node at all: there is nothing to hide.
    const group = controls.slice(controls.indexOf("export function ToolbarGroup"));
    expect(group).not.toContain("aria-hidden");
    expect(group).not.toMatch(/[\u2500-\u257F]/u);
  });
});
