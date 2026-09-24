import { z } from "zod";

/**
 * The dashboard widget registry (ADR-046). One entry per widget, per variant; the layout stored
 * for a user is validated against these ids, so a stale or forged widget id can never be written.
 */

export const DASHBOARD_VARIANTS = ["today", "overview", "career", "productivity"] as const;
export type DashboardVariant = (typeof DASHBOARD_VARIANTS)[number];

export const WIDGET_SIZES = ["s", "m", "l"] as const;
export type WidgetSize = (typeof WIDGET_SIZES)[number];

export interface DashboardWidget {
  id: string;
  variant: DashboardVariant;
  label: string;
  defaultSize: WidgetSize;
  /** Only what a widget cannot render without; everything else renders its own empty state. */
  note?: string;
}

export const DASHBOARD_WIDGETS: DashboardWidget[] = [
  { id: "today.top3", variant: "today", label: "top 3", defaultSize: "m" },
  { id: "today.counts", variant: "today", label: "overdue / due today / inbox", defaultSize: "m" },
  { id: "today.planned", variant: "today", label: "planned minutes", defaultSize: "s" },
  { id: "overview.kpis", variant: "overview", label: "KPI table", defaultSize: "l" },
  { id: "overview.wins", variant: "overview", label: "habit streaks", defaultSize: "m" },
  { id: "career.funnel", variant: "career", label: "pipeline funnel", defaultSize: "l" },
  { id: "career.open", variant: "career", label: "open applications", defaultSize: "s" },
  { id: "career.analytics", variant: "career", label: "sources and weeks", defaultSize: "m" },
  { id: "productivity.kpis", variant: "productivity", label: "work KPIs", defaultSize: "m" },
  { id: "productivity.focus", variant: "productivity", label: "focus this week", defaultSize: "s" },
  { id: "productivity.reviews", variant: "productivity", label: "review streak", defaultSize: "s" },
];

export const widgetIdsFor = (variant: DashboardVariant): string[] =>
  DASHBOARD_WIDGETS.filter((widget) => widget.variant === variant).map((widget) => widget.id);

export const widgetSchema = z.object({
  id: z.string().min(1),
  visible: z.boolean(),
  /** Position within the variant, ascending. */
  position: z.number().int().min(0).max(100),
});

export const layoutSchema = z.object({
  variant: z.enum(DASHBOARD_VARIANTS),
  widgets: z.array(widgetSchema).max(40),
});

export type LayoutInput = z.infer<typeof layoutSchema>;

/** Registry order, filtered to the variant — the default a user has before saving anything. */
export function defaultLayout(variant: DashboardVariant): LayoutInput {
  return {
    variant,
    widgets: widgetIdsFor(variant).map((id, index) => ({
      id,
      visible: true,
      position: index,
    })),
  };
}

/**
 * Merge a saved layout with the registry: saved rows win, registry widgets the user has never
 * touched keep their default (visible, after the saved ones). This is what makes a newly shipped
 * widget appear without a migration.
 */
export function mergeLayout(variant: DashboardVariant, saved: LayoutInput["widgets"]): LayoutInput {
  const known = new Set(widgetIdsFor(variant));
  const savedById = new Map(
    saved.filter((widget) => known.has(widget.id)).map((widget) => [widget.id, widget]),
  );
  const merged: LayoutInput["widgets"] = [];
  let position = 0;
  for (const id of widgetIdsFor(variant)) {
    const entry = savedById.get(id);
    merged.push({
      id,
      visible: entry?.visible ?? true,
      position: position++,
    });
  }
  // A saved order is respected by sorting on the stored position first.
  return {
    variant,
    widgets: merged.sort((a, b) => {
      const aSaved = savedById.get(a.id)?.position ?? Number.MAX_SAFE_INTEGER;
      const bSaved = savedById.get(b.id)?.position ?? Number.MAX_SAFE_INTEGER;
      return aSaved - bSaved;
    }),
  };
}
