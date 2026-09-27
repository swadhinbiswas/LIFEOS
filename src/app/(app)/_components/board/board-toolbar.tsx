"use client";

import { useTranslations } from "next-intl";

import { QUICK_FILTERS, type QuickFilterId } from "@/config/board-filters";
import { RENDERED_VIEWS, type BoardView } from "@/config/boards";

import { cn } from "cn";

import { chipState, controlField } from "@/components/tui/controls";

export type GroupBy = "none" | "column" | "priority";
export const GROUP_OPTIONS: { id: GroupBy; label: string }[] = [
  { id: "none", label: "no grouping" },
  { id: "column", label: "group by column" },
  { id: "priority", label: "group by priority" },
];

/** Message key for each quick filter's label (spec §6.1). */
const FILTER_KEYS: Record<QuickFilterId, string> = {
  "due-today": "dueTodayFilter",
  overdue: "overdueFilter",
  "p0-p1": "p0p1",
  "no-date": "noDate",
  stale: "stale",
};

const GROUP_KEYS: Record<GroupBy, string> = {
  none: "noGrouping",
  column: "groupByColumn",
  priority: "groupByPriority",
};

/**
 * Board toolbar (spec §6.1): view switch, quick-filter chips, grouping and the text filter.
 * All of it writes nuqs URL state (ADR-042), so a filtered table is shareable.
 */
export function BoardToolbar({
  view,
  onView,
  filters,
  onToggleFilter,
  group,
  onGroup,
  query,
  onQuery,
  count,
  syncing,
  showGroup,
}: {
  view: BoardView;
  onView: (view: BoardView) => void;
  filters: QuickFilterId[];
  onToggleFilter: (filter: QuickFilterId) => void;
  group: GroupBy;
  onGroup: (group: GroupBy) => void;
  query: string;
  onQuery: (value: string) => void;
  count: number;
  syncing: boolean;
  /** Grouping renders in the table view; kanban swimlanes are a later chunk (no dead control). */
  showGroup: boolean;
}) {
  const t = useTranslations("Pages.Board");
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1" data-slot="board-toolbar">
      <fieldset className="flex items-center gap-1">
        <legend className="sr-only">{t("view")}</legend>
        {RENDERED_VIEWS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            aria-pressed={view === candidate}
            className={chipState(view === candidate)}
            onClick={() => onView(candidate)}
          >
            {t(candidate)}
          </button>
        ))}
      </fieldset>

      <fieldset className="flex flex-wrap items-center gap-1">
        <legend className="sr-only">{t("quickFilters")}</legend>
        {QUICK_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            aria-pressed={filters.includes(filter.id)}
            className={chipState(filters.includes(filter.id))}
            onClick={() => onToggleFilter(filter.id)}
          >
            {t(FILTER_KEYS[filter.id])}
          </button>
        ))}
      </fieldset>

      {showGroup ? (
        <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
          <label htmlFor="board-group">{t("group")}</label>
          <select
            id="board-group"
            value={group}
            onChange={(event) => onGroup(event.target.value as GroupBy)}
            className="border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
          >
            {GROUP_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {t(GROUP_KEYS[option.id])}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <label className="sr-only" htmlFor="board-search">
        {t("filterByTitle")}
      </label>
      <input
        id="board-search"
        data-search=""
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder={t("filterCards")}
        className={cn(controlField, "w-40 px-2 py-0.5 text-[10px] focus-visible:border-ring")}
      />

      <p
        className="ml-auto pl-2 font-mono text-[10px] text-muted-foreground"
        role="status"
        data-slot="card-count"
      >
        {t("cardCount", { count })}
        {syncing ? t("syncing") : ""}
      </p>
    </div>
  );
}
