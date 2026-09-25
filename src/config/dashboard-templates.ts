import { DASHBOARD_WIDGETS, type DashboardVariant } from "./dashboard-widgets";

/**
 * Starter dashboard layouts (ADR-108) — the dashboard's answer to a board template.
 *
 * The widget registry already made every variant customizable (ADR-046), but a new user arrives at
 * "every widget, in registry order", which is a reasonable default and a poor first impression. A
 * template is a named set of widgets for one variant: applying it is exactly a `saveLayout` call,
 * so there is no second layout format to keep in sync and no migration.
 *
 * A template lists only ids registered for its own variant; anything else is dropped by
 * `templateLayout` rather than written, so a typo can never smuggle an unknown widget into a
 * user's saved layout.
 */

export interface DashboardTemplate {
  id: string;
  variant: DashboardVariant;
  /** Message key under `Widgets.templates`; the label is translated, never hardcoded. */
  key: string;
  /** One-line description of what this layout is for. */
  hintKey: string;
  /** Widget ids in display order. Ids outside the variant are ignored. */
  widgets: string[];
}

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  {
    id: "day",
    variant: "today",
    key: "day",
    hintKey: "dayHint",
    widgets: ["today.brief", "today.counts", "today.top3", "today.queue", "today.planned"],
  },
  {
    id: "balanced",
    variant: "today",
    key: "balanced",
    hintKey: "balancedHint",
    widgets: [
      "today.brief",
      "today.pulse",
      "today.counts",
      "today.habits",
      "today.top3",
      "today.focus",
      "today.queue",
      "today.planned",
    ],
  },
  {
    id: "focus",
    variant: "today",
    key: "focus",
    hintKey: "focusHint",
    widgets: ["today.brief", "today.top3", "today.focus", "today.counts", "today.planned"],
  },
  {
    id: "everything",
    variant: "today",
    key: "everything",
    hintKey: "everythingHint",
    widgets: DASHBOARD_WIDGETS.filter((widget) => widget.variant === "today").map((w) => w.id),
  },
  {
    id: "numbers",
    variant: "overview",
    key: "numbers",
    hintKey: "numbersHint",
    widgets: ["overview.kpis", "overview.wins"],
  },
  {
    id: "everything",
    variant: "overview",
    key: "everything",
    hintKey: "everythingHint",
    widgets: DASHBOARD_WIDGETS.filter((widget) => widget.variant === "overview").map((w) => w.id),
  },
  {
    id: "pipeline",
    variant: "career",
    key: "pipeline",
    hintKey: "pipelineHint",
    widgets: [
      "career.funnel",
      "career.velocity",
      "career.stale",
      "career.open",
      "career.analytics",
    ],
  },
  {
    id: "shipped",
    variant: "productivity",
    key: "shipped",
    hintKey: "shippedHint",
    widgets: [
      "productivity.done",
      "productivity.focus",
      "productivity.kpis",
      "productivity.reviews",
    ],
  },
  {
    id: "hours",
    variant: "code",
    key: "hours",
    hintKey: "hoursHint",
    widgets: ["code.kpis", "code.time", "code.languages", "code.harnesses", "code.connection"],
  },
  {
    id: "ai",
    variant: "code",
    key: "ai",
    hintKey: "aiHint",
    widgets: ["code.ai", "code.time", "code.kpis", "code.languages", "code.connection"],
  },
  {
    id: "everything",
    variant: "code",
    key: "everything",
    hintKey: "everythingHint",
    widgets: DASHBOARD_WIDGETS.filter((widget) => widget.variant === "code").map((w) => w.id),
  },
];

export function findDashboardTemplate(
  variant: DashboardVariant,
  id: string,
): DashboardTemplate | undefined {
  return DASHBOARD_TEMPLATES.find((template) => template.variant === variant && template.id === id);
}

export function templatesForVariant(variant: DashboardVariant): DashboardTemplate[] {
  return DASHBOARD_TEMPLATES.filter((template) => template.variant === variant);
}

/**
 * The template as a layout the user can save: its widgets visible, in order, then every other
 * registered widget for the variant hidden — so applying a layout is a complete statement about
 * the variant rather than a partial one that leaves stale widgets visible.
 */
export function templateLayout(
  variant: DashboardVariant,
  id: string,
): {
  variant: DashboardVariant;
  widgets: Array<{ id: string; visible: boolean; position: number }>;
} | null {
  const template = findDashboardTemplate(variant, id);
  if (!template) return null;

  const known = new Set(
    DASHBOARD_WIDGETS.filter((widget) => widget.variant === variant).map((widget) => widget.id),
  );
  const wanted = template.widgets.filter((widgetId) => known.has(widgetId));
  const ordered = [
    ...new Set([
      ...wanted,
      ...DASHBOARD_WIDGETS.filter((w) => w.variant === variant).map((w) => w.id),
    ]),
  ];

  return {
    variant,
    widgets: ordered.map((widgetId, position) => ({
      id: widgetId,
      visible: wanted.includes(widgetId),
      position,
    })),
  };
}
