"use client";

import { QUICK_FILTERS, type QuickFilterId } from "@/config/board-filters";
import { BOARD_VIEWS, type BoardView } from "@/config/boards";
import { cn } from "@/lib/utils";

export type GroupBy = "none" | "column" | "priority";
export const GROUP_OPTIONS: { id: GroupBy; label: string }[] = [
  { id: "none", label: "no grouping" },
  { id: "column", label: "group by column" },
  { id: "priority", label: "group by priority" },
];

const chip = (active: boolean) =>
  cn(
    "rounded-[var(--radius)] border px-2 py-0.5 font-mono text-[10px]",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-background text-foreground",
  );

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
  return (
    <div className="flex flex-wrap items-center gap-3" data-slot="board-toolbar">
      <fieldset className="flex items-center gap-1">
        <legend className="sr-only">view</legend>
        {BOARD_VIEWS.filter((candidate) => candidate === "kanban" || candidate === "table").map(
          (candidate) => (
            <button
              key={candidate}
              type="button"
              aria-pressed={view === candidate}
              className={chip(view === candidate)}
              onClick={() => onView(candidate)}
            >
              {candidate}
            </button>
          ),
        )}
      </fieldset>

      <span className="font-mono text-[10px] text-muted-foreground" aria-hidden="true">
        |
      </span>

      <fieldset className="flex flex-wrap items-center gap-1">
        <legend className="sr-only">quick filters</legend>
        {QUICK_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            aria-pressed={filters.includes(filter.id)}
            className={chip(filters.includes(filter.id))}
            onClick={() => onToggleFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </fieldset>

      {showGroup ? (
        <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
          <label htmlFor="board-group">group</label>
          <select
            id="board-group"
            value={group}
            onChange={(event) => onGroup(event.target.value as GroupBy)}
            className="border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
          >
            {GROUP_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <label className="sr-only" htmlFor="board-search">
        filter cards by title
      </label>
      <input
        id="board-search"
        data-search=""
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="filter cards…"
        className="w-48 border border-border bg-background px-2 py-0.5 font-mono text-xs outline-none"
      />

      <p className="font-mono text-[10px] text-muted-foreground" role="status">
        {count} card{count === 1 ? "" : "s"}
        {syncing ? " · syncing…" : ""}
      </p>
    </div>
  );
}
