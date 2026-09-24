/**
 * KPI arithmetic for the dashboards (spec §6.8). Pure over plain rows so every number a dashboard
 * shows can be hand-checked in a test — the spec's acceptance line is literally "every KPI matches
 * a hand-calculated fixture", which only holds if the computation does not live inside a chart.
 *
 * Each KPI is defined once here with its label, its plain-language definition (the tooltip the
 * spec asks for) and the route of the filtered list behind it, so a dashboard cannot show a number
 * that has no source list to open.
 */

export interface KpiDefinition {
  id: string;
  label: string;
  /** Shown as the tooltip: what exactly is counted. */
  definition: string;
  /** The filtered list this number comes from. */
  href: string;
}

export const KPI_DEFINITIONS: Record<string, KpiDefinition> = {
  tasksDoneThisWeek: {
    id: "tasksDoneThisWeek",
    label: "tasks done this week",
    definition: "cards moved into a done column since Monday, this week only",
    href: "/tasks?view=table",
  },
  focusMinutesThisWeek: {
    id: "focusMinutesThisWeek",
    label: "focus minutes",
    definition: "minutes from completed focus sessions starting this week",
    href: "/focus",
  },
  habitConsistency: {
    id: "habitConsistency",
    label: "habit consistency",
    definition: "habit check-ins logged in the last 7 days ÷ (habits × 7)",
    href: "/habits",
  },
  activeGoals: {
    id: "activeGoals",
    label: "active goals",
    definition: "objectives whose status is active",
    href: "/goals",
  },
  openApplications: {
    id: "openApplications",
    label: "open applications",
    definition: "job cards not in a terminal stage (Accepted, Rejected, Withdrawn)",
    href: "/career/jobs",
  },
  budgetRemaining: {
    id: "budgetRemaining",
    label: "budget remaining",
    definition: "monthly budget limits minus this month's spend, per currency",
    href: "/finance",
  },
};

export interface KpiValue {
  id: string;
  value: number | null;
  /** Change against the previous period, or null when there is nothing to compare. */
  delta: number | null;
  /** Rendered unit, e.g. "min" or a currency code; null for a bare count. */
  unit: string | null;
}

export interface KpiFixtureInput {
  /** Cards completed this week / the week before, by completion instant. */
  completedThisWeek: number;
  completedLastWeek: number;
  focusMinutesThisWeek: number;
  focusMinutesLastWeek: number;
  /** Habit check-ins in the last 7 days and the 7 before that, plus the habit count. */
  habitLogsThisWeek: number;
  habitLogsLastWeek: number;
  habitCount: number;
  activeGoals: number;
  /** Snapshots have no history to compare against; null means "no comparison", not zero. */
  activeGoalsLastWeek: number | null;
  openApplications: number;
  openApplicationsLastWeek: number | null;
  budgetRemainingMinor: number;
  budgetRemainingLastMonthMinor: number | null;
  currency: string | null;
}

const percent = (part: number, whole: number): number =>
  whole <= 0 ? 0 : Math.round((part / whole) * 100);

/** A delta only exists when both sides are known. */
const delta = (current: number, previous: number | null): number | null =>
  previous === null ? null : current - previous;

export function computeKpis(input: KpiFixtureInput): KpiValue[] {
  return [
    {
      id: "tasksDoneThisWeek",
      value: input.completedThisWeek,
      delta: input.completedThisWeek - input.completedLastWeek,
      unit: null,
    },
    {
      id: "focusMinutesThisWeek",
      value: input.focusMinutesThisWeek,
      delta: input.focusMinutesThisWeek - input.focusMinutesLastWeek,
      unit: "min",
    },
    {
      id: "habitConsistency",
      value: percent(input.habitLogsThisWeek, input.habitCount * 7),
      delta:
        percent(input.habitLogsThisWeek, input.habitCount * 7) -
        percent(input.habitLogsLastWeek, input.habitCount * 7),
      unit: "%",
    },
    {
      id: "activeGoals",
      value: input.activeGoals,
      delta: delta(input.activeGoals, input.activeGoalsLastWeek),
      unit: null,
    },
    {
      id: "openApplications",
      value: input.openApplications,
      delta: delta(input.openApplications, input.openApplicationsLastWeek),
      unit: null,
    },
    {
      id: "budgetRemaining",
      value: input.budgetRemainingMinor,
      delta: delta(input.budgetRemainingMinor, input.budgetRemainingLastMonthMinor),
      unit: input.currency,
    },
  ];
}
