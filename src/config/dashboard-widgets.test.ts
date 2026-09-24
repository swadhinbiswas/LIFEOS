import { describe, expect, it } from "vitest";

import {
  defaultLayout,
  DASHBOARD_VARIANTS,
  DASHBOARD_WIDGETS,
  layoutSchema,
  mergeLayout,
  widgetIdsFor,
} from "./dashboard-widgets";

describe("dashboard widget registry (adr-046)", () => {
  it("gives every variant at least one widget and every widget a known variant", () => {
    for (const variant of DASHBOARD_VARIANTS) {
      expect(widgetIdsFor(variant).length).toBeGreaterThan(0);
    }
    expect(
      DASHBOARD_WIDGETS.filter((widget) => !DASHBOARD_VARIANTS.includes(widget.variant)),
    ).toEqual([]);
    const ids = DASHBOARD_WIDGETS.map((widget) => widget.id);
    expect(new Set(ids).size).toBe(ids.length); // ids are unique
  });

  it("defaults to everything visible in registry order", () => {
    const layout = defaultLayout("overview");
    expect(layout.widgets.map((widget) => widget.id)).toEqual(widgetIdsFor("overview"));
    expect(layout.widgets.every((widget) => widget.visible)).toBe(true);
    expect(layoutSchema.safeParse(layout).success).toBe(true);
  });

  it("merges saved visibility and order, and drops unknown or foreign ids", () => {
    const merged = mergeLayout("overview", [
      { id: "overview.wins", visible: false, position: 0 },
      { id: "overview.kpis", visible: true, position: 1 },
      { id: "today.top3", visible: true, position: 2 }, // belongs to another variant
      { id: "ghost.widget", visible: true, position: 3 }, // never registered
    ]);

    expect(merged.widgets.map((widget) => widget.id)).toEqual(["overview.wins", "overview.kpis"]);
    expect(merged.widgets[0]?.visible).toBe(false);
  });

  it("rejects a layout that references an unknown variant", () => {
    expect(layoutSchema.safeParse({ variant: "nope", widgets: [] }).success).toBe(false);
  });
});
