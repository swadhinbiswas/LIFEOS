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
  /** Message key under `Widgets`; the dashboard translates the label (ADR-072). */
  key: string;
  defaultSize: WidgetSize;
  /** Only what a widget cannot render without; everything else renders its own empty state. */
  note?: string;
}

export const DASHBOARD_WIDGETS: DashboardWidget[] = [
  {
    id: "today.brief",
    variant: "today",
    label: "morning brief",
    key: "todayBrief",
    defaultSize: "l",
  },
  {
    id: "today.pulse",
    variant: "today",
    label: "habit pulse",
    key: "todayPulse",
    defaultSize: "l",
  },
  {
    id: "today.counts",
    variant: "today",
    label: "overdue / due today / inbox",
    key: "todayCounts",
    defaultSize: "m",
  },
  {
    id: "today.habits",
    variant: "today",
    label: "habit constellation",
    key: "todayHabits",
    defaultSize: "m",
  },
  {
    id: "today.focus",
    variant: "today",
    label: "focus rhythm",
    key: "todayFocus",
    defaultSize: "m",
  },
  {
    id: "today.queue",
    variant: "today",
    label: "open card queue",
    key: "todayQueue",
    defaultSize: "s",
  },
  { id: "today.top3", variant: "today", label: "top 3", key: "todayTop3", defaultSize: "m" },
  {
    id: "today.planned",
    variant: "today",
    label: "planned minutes",
    key: "todayPlanned",
    defaultSize: "s",
  },
  {
    id: "overview.kpis",
    variant: "overview",
    label: "KPIs",
    key: "overviewKpis",
    defaultSize: "l",
  },
  {
    id: "overview.wins",
    variant: "overview",
    label: "habit streaks",
    key: "overviewWins",
    defaultSize: "m",
  },
  {
    id: "career.funnel",
    variant: "career",
    label: "pipeline funnel",
    key: "careerFunnel",
    defaultSize: "l",
  },
  {
    id: "career.velocity",
    variant: "career",
    label: "applications per week",
    key: "careerVelocity",
    defaultSize: "m",
  },
  {
    id: "career.stale",
    variant: "career",
    label: "needs a follow-up",
    key: "careerStale",
    defaultSize: "m",
  },
  {
    id: "career.open",
    variant: "career",
    label: "open applications",
    key: "careerOpen",
    defaultSize: "s",
  },
  {
    id: "career.analytics",
    variant: "career",
    label: "sources",
    key: "careerAnalytics",
    defaultSize: "m",
  },
  {
    id: "productivity.kpis",
    variant: "productivity",
    label: "work KPIs",
    key: "productivityKpis",
    defaultSize: "m",
  },
  {
    id: "productivity.done",
    variant: "productivity",
    label: "tasks done per day",
    key: "productivityDone",
    defaultSize: "m",
  },
  {
    id: "productivity.focus",
    variant: "productivity",
    label: "focus rhythm",
    key: "productivityFocus",
    defaultSize: "m",
  },
  {
    id: "productivity.reviews",
    variant: "productivity",
    label: "review streak",
    key: "productivityReviews",
    defaultSize: "s",
  },
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
