/**
 * Quick-filter chips (spec §6.1: "Due today, Overdue, P0–P1, No date, Stale > 14d"). Pure
 * predicates over a card so the kanban board and the table view filter identically, and the
 * URL (`?filter=overdue,p0-p1`) stays the single source of the active set.
 *
 * Dates are compared in UTC (ADR-015 stores UTC; per-user timezone rendering arrives with the
 * calendar module, and the comparison that matters here — "is it past due" — is day-granular).
 */

export interface FilterableCard {
  priority: string | null;
  due_at: Date | null;
  updated_at: Date;
  completed_at: Date | null;
}

export const QUICK_FILTERS = [
  { id: "due-today", label: "Due today" },
  { id: "overdue", label: "Overdue" },
  { id: "p0-p1", label: "P0–P1" },
  { id: "no-date", label: "No date" },
  { id: "stale", label: "Stale > 14d" },
] as const;

export type QuickFilterId = (typeof QUICK_FILTERS)[number]["id"];

export const QUICK_FILTER_IDS = QUICK_FILTERS.map((filter) => filter.id) as QuickFilterId[];

const startOfUtcDay = (date: Date): number =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

export function cardMatchesFilter(
  card: FilterableCard,
  filter: QuickFilterId,
  now: Date = new Date(),
): boolean {
  switch (filter) {
    case "due-today": {
      if (!card.due_at) return false;
      const due = startOfUtcDay(new Date(card.due_at));
      return due === startOfUtcDay(now);
    }
    case "overdue": {
      if (!card.due_at || card.completed_at) return false;
      return startOfUtcDay(new Date(card.due_at)) < startOfUtcDay(now);
    }
    case "p0-p1":
      return card.priority === "p0" || card.priority === "p1";
    case "no-date":
      return card.due_at === null;
    case "stale": {
      if (card.completed_at) return false;
      const threshold = now.getTime() - 14 * 24 * 60 * 60 * 1000;
      return new Date(card.updated_at).getTime() < threshold;
    }
    default:
      return true;
  }
}

/** Parses `?filter=` into known ids, ignoring anything unrecognised (never throws on URL input). */
export function parseQuickFilters(value: string | null | undefined): QuickFilterId[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is QuickFilterId => (QUICK_FILTER_IDS as string[]).includes(part));
}

export const serializeQuickFilters = (filters: QuickFilterId[]): string | null =>
  filters.length === 0 ? null : filters.join(",");
