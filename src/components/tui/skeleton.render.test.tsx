/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  BoardSkeleton,
  ChartSkeleton,
  FieldGridSkeleton,
  FormSkeleton,
  ListSkeleton,
  PanelSkeleton,
  TileSkeleton,
} from "./skeleton";

/**
 * These assert the *rendered* shape, which the source-level sibling test cannot. A skeleton is only
 * worth anything if it draws the right thing, and a component that compiles can still draw nothing:
 * an earlier draft of this file had a `hint` prop typed as `string` while callers passed the JSX
 * shorthand, which typechecked as a boolean and threw.
 *
 * The e2e half (`tests/e2e/skeleton.spec.ts`) covers the sweep's CSS. This covers the markup.
 *
 * `PageHeaderSkeleton` is deliberately absent here: it is an async server component so its heading
 * text can be translated, and its heading contract is asserted by the axe sweep instead, which is
 * the only thing that can actually see a document's top level.
 */
afterEach(cleanup);

describe("skeleton vocabulary", () => {
  it("draws only the shadcn primitive, never a hand-rolled block", () => {
    // The vendored skin is applied by `[data-slot="skeleton"]` in CSS, so a block that is not the
    // shadcn component silently opts out of the sweep.
    for (const element of [
      <BoardSkeleton key="board" />,
      <ChartSkeleton key="chart" />,
      <FieldGridSkeleton key="fields" />,
      <FormSkeleton key="form" />,
    ]) {
      const { container } = render(element);
      // Layout wrappers carry no `data-slot` and no fill of their own, so an *empty* one is fine; a
      // styled div that is not the primitive would be the block that never sweeps.
      const handRolled = [...container.querySelectorAll("div")].filter((node) => {
        if (node.hasAttribute("data-slot")) return false;
        const name = node.getAttribute("class") ?? "";
        return name !== "" && !/^flex |^grid /.test(name);
      });
      expect(handRolled, element.type?.name ?? "component").toEqual([]);
      expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    }
  });

  it("keeps every block a skeleton, so a panel always draws something", () => {
    const { container } = render(<PanelSkeleton rows={3} />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(3);
  });

  it("gives the panel skeleton the chip geometry the real panel uses", () => {
    render(<PanelSkeleton label="w-24" hint />);
    const chip = document.querySelector('[data-slot="skeleton-panel"] span');
    expect(chip?.className).toMatch(/top-0/u);
    expect(chip?.className).toMatch(/left-3/u);
    expect(chip?.className).toMatch(/-translate-y-1\/2/u);
    // The chip sits on the card background, which is what breaks the frame.
    expect(chip?.className).toMatch(/bg-card/u);
  });

  it("draws the right-hand count chip only when asked", () => {
    const { rerender } = render(<PanelSkeleton />);
    const panel = () => document.querySelector('[data-slot="skeleton-panel"]');
    expect(panel()?.querySelectorAll("span")).toHaveLength(1);

    rerender(<PanelSkeleton hint />);
    expect(panel()?.querySelectorAll("span")).toHaveLength(2);
  });

  it("varies row widths so a list reads as text, not as a stuck progress bar", () => {
    const { container } = render(<PanelSkeleton rows={4} />);
    const widths = [...container.querySelectorAll('[data-slot="skeleton"]')]
      .map((node) => node.className)
      .filter((name) => name.includes("w-") || name.includes("w-full"));
    // At least two distinct trailing widths across the rows.
    expect(new Set(widths).size).toBeGreaterThan(1);
  });

  it("uses a chart's own height for a chart", () => {
    const { container } = render(<ChartSkeleton />);
    const bars = container.querySelectorAll('[data-slot="skeleton-chart"] > *');
    expect(bars).toHaveLength(8);
    // A chart's silhouette is a skyline; equal bars read as a table of nothing.
    const heights = [...bars].map((bar) => (bar as HTMLElement).style.height);
    expect(new Set(heights).size).toBeGreaterThan(3);
  });

  it("marks a chart placeholder decorative, so nothing is announced mid-swap", () => {
    render(<ChartSkeleton />);
    expect(screen.getByRole("presentation", { hidden: true })).toBeInTheDocument();
  });

  it("counts tiles and keeps a leading marker off list rows when told", () => {
    const { container: tiles } = render(<TileSkeleton count={3} />);
    expect(tiles.querySelectorAll('[data-slot="skeleton-tiles"] > div')).toHaveLength(3);

    const { container: withMarkers } = render(<ListSkeleton rows={2} />);
    expect(withMarkers.querySelectorAll('[data-slot="skeleton-list"] .size-4')).toHaveLength(2);

    const { container: without } = render(<ListSkeleton rows={2} leading={false} />);
    expect(without.querySelectorAll('[data-slot="skeleton-list"] .size-4')).toHaveLength(0);
  });

  it("draws one caption and one control per field, plus a submit", () => {
    const { container } = render(<FormSkeleton fields={3} />);
    // `Skeleton` renders a div, so counting children would count the submit as a field. The rows
    // are the ones that stack a caption over a control.
    const rows = [...container.querySelectorAll('[data-slot="skeleton-form"] > div')].filter(
      (node) => node.querySelectorAll('[data-slot="skeleton"]').length === 2,
    );
    expect(rows).toHaveLength(3);
    // Caption above, control below: the order a real labelled field uses.
    const [caption, control] = [...(rows[0]?.children ?? [])];
    expect(caption?.className).toMatch(/h-2\.5/u);
    expect(control?.className).toMatch(/h-8/u);
    // The submit is the last child and is narrower than a field, the way a real button is.
    const submit = container.querySelector('[data-slot="skeleton-form"]')?.lastElementChild;
    expect(submit?.className).toMatch(/w-28/u);
  });

  it("draws board columns of the width a kanban column actually is", () => {
    const { container } = render(<BoardSkeleton columns={3} cards={2} />);
    const columns = container.querySelectorAll('[data-slot="skeleton-board"] > div');
    expect(columns).toHaveLength(3);
    for (const column of columns) {
      expect(column.className).toMatch(/w-64/u);
      // Header plus the cards, and the cards do not stretch the column.
      expect(column.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3);
    }
  });

  it("pairs a term with a value in the field grid, because a <dl> may only hold those", () => {
    const { container } = render(<FieldGridSkeleton fields={4} />);
    const grid = container.querySelector('[data-slot="skeleton-fields"]');
    expect(grid?.tagName).toBe("DL");
    for (const pair of grid?.children ?? []) {
      expect(pair.children[0]?.tagName).toBe("DT");
      expect(pair.children[1]?.tagName).toBe("DD");
    }
  });
});
