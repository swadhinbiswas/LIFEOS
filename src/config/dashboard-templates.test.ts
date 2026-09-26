import { describe, expect, it } from "vitest";

import {
  DASHBOARD_TEMPLATES,
  findDashboardTemplate,
  templateLayout,
  templatesForVariant,
} from "./dashboard-templates";
import { DASHBOARD_VARIANTS, DASHBOARD_WIDGETS, widgetIdsFor } from "./dashboard-widgets";

describe("starter dashboard layouts (ADR-108)", () => {
  it("only ever names widgets registered for its own variant", () => {
    for (const template of DASHBOARD_TEMPLATES) {
      const known = new Set(widgetIdsFor(template.variant));
      expect(template.widgets.length, template.id + " should not be empty").toBeGreaterThan(0);
      for (const id of template.widgets) {
        expect(known.has(id), template.variant + "/" + template.id + " names " + id).toBe(true);
      }
    }
  });

  it("covers every variant that has widgets", () => {
    for (const variant of DASHBOARD_VARIANTS) {
      expect(templatesForVariant(variant).length, variant + " needs a starter").toBeGreaterThan(0);
    }
  });

  it("turns a template into a complete, ordered layout", () => {
    const layout = templateLayout("today", "day");
    expect(layout).not.toBeNull();
    const visible = layout!.widgets.filter((widget) => widget.visible).map((widget) => widget.id);
    expect(visible).toEqual([
      // The day's signals lead: the row that makes the rest legible (ADR-132).
      "today.signals",
      "today.brief",
      "today.counts",
      "today.top3",
      "today.queue",
      "today.planned",
    ]);

    // Complete means complete: every registered widget is present, hidden ones included.
    expect(layout!.widgets).toHaveLength(widgetIdsFor("today").length);
    expect(layout!.widgets.map((widget) => widget.position)).toEqual(
      layout!.widgets.map((_, index) => index),
    );
  });

  it("drops an id that is not registered, rather than saving it", () => {
    // A typo in the registry must not smuggle an unknown widget into a saved layout.
    DASHBOARD_TEMPLATES.push({
      id: "typo",
      variant: "today",
      key: "day",
      hintKey: "dayHint",
      widgets: ["today.brief", "ghost.widget", "career.funnel"],
    });
    try {
      const layout = templateLayout("today", "typo");
      const visible = layout!.widgets.filter((widget) => widget.visible).map((widget) => widget.id);
      expect(visible).toEqual(["today.brief"]);
      // A cross-variant id is dropped too: today cannot show the career funnel.
      expect(layout!.widgets.map((widget) => widget.id)).not.toContain("career.funnel");
      expect(layout!.widgets.map((widget) => widget.id)).not.toContain("ghost.widget");
    } finally {
      DASHBOARD_TEMPLATES.pop();
    }
  });
  it("is null for an unknown template, so the action can refuse it", () => {
    expect(templateLayout("today", "nope")).toBeNull();
    expect(findDashboardTemplate("career", "day")).toBeUndefined();
  });

  it("has an 'everything' template that really is everything", () => {
    const layout = templateLayout("career", "pipeline");
    expect(layout!.widgets.filter((widget) => widget.visible).length).toBe(
      DASHBOARD_WIDGETS.filter((widget) => widget.variant === "career").length,
    );
  });
});
