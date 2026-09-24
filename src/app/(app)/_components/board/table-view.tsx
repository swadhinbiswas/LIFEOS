"use client";

import {
  createSortedRowModel,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useMemo } from "react";

import type { BoardPayload, Card } from "@/server/boards";

import type { GroupBy } from "./board-toolbar";

/**
 * Table view (spec §6.1) over the same board data, on TanStack Table v9 — re-read at build
 * time per the Phase-0 research note: features are opt-in via `tableFeatures`, the instance
 * comes from `useTable`, and cells render through `table.FlexRender`.
 *
 * Grouping is done above the table (one table per group) so sorting stays per-group without
 * the experimental grouping row models.
 */

interface Row {
  id: string;
  title: string;
  columnName: string;
  priority: string;
  /** Sortable numeric forms; the labels are what render. */
  due: number;
  dueLabel: string;
  estimate: number;
}

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
});

const columns: Array<ColumnDef<typeof features, Row>> = [
  { accessorKey: "title", header: "card" },
  { accessorKey: "columnName", header: "column" },
  {
    accessorKey: "priority",
    header: "priority",
    cell: (info) => info.row.original.priority,
  },
  {
    accessorKey: "due",
    header: "due",
    cell: (info) => info.row.original.dueLabel,
  },
  {
    accessorKey: "estimate",
    header: "estimate (min)",
    cell: (info) => (info.row.original.estimate === 0 ? "" : info.row.original.estimate),
  },
];

const dayLabel = (date: Date | null): string =>
  date ? new Date(date).toISOString().slice(0, 10) : "";

function toRow(card: Card, payload: BoardPayload): Row {
  return {
    id: card.id,
    title: card.title,
    columnName: payload.columns.find((column) => column.id === card.column_id)?.name ?? "",
    priority: card.priority ?? "—",
    due: card.due_at ? new Date(card.due_at).getTime() : Number.MAX_SAFE_INTEGER,
    dueLabel: dayLabel(card.due_at),
    estimate: card.estimate_min ?? 0,
  };
}

function GroupTable({
  label,
  rows,
  onOpen,
}: {
  label: string;
  rows: Row[];
  onOpen: (cardId: string) => void;
}) {
  const table = useTable({
    key: `board-table-${label}`,
    features,
    columns,
    data: rows,
    getRowId: (row) => row.id,
  });

  return (
    <section aria-label={label} className="flex flex-col gap-1">
      <h2 className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
        {label} <span className="tabular-nums">{rows.length}</span>
      </h2>
      <table className="w-full border-collapse font-mono text-xs">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  scope="col"
                  className="border-b border-border px-2 py-1 text-left font-medium tracking-wider text-muted-foreground uppercase"
                >
                  {header.isPlaceholder ? null : (
                    <button
                      type="button"
                      className="flex items-center gap-1"
                      onClick={header.column.getToggleSortingHandler()}
                      disabled={!header.column.getCanSort()}
                    >
                      <table.FlexRender header={header} />
                      {header.column.getIsSorted() === "asc"
                        ? "▲"
                        : header.column.getIsSorted() === "desc"
                          ? "▼"
                          : ""}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} data-slot="table-row" data-card-id={row.original.id}>
              {row.getAllCells().map((cell) => (
                <td key={cell.id} className="border-b border-border px-2 py-1">
                  {cell.column.id === "title" ? (
                    <button
                      type="button"
                      className="text-left hover:text-primary"
                      onClick={() => onOpen(row.original.id)}
                    >
                      <table.FlexRender cell={cell} />
                    </button>
                  ) : (
                    <table.FlexRender cell={cell} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function TableView({
  payload,
  group,
  onOpen,
}: {
  payload: BoardPayload;
  group: GroupBy;
  onOpen: (cardId: string) => void;
}) {
  const groups = useMemo(() => {
    const rows = payload.cards.map((card) => toRow(card, payload));
    if (group === "none") return [{ key: "all", label: "all cards", rows }];

    const buckets = new Map<string, Row[]>();
    for (const row of rows) {
      const key = group === "priority" ? row.priority : row.columnName || "—";
      const bucket = buckets.get(key) ?? [];
      bucket.push(row);
      buckets.set(key, bucket);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, bucket]) => ({ key, label: key, rows: bucket }));
  }, [payload, group]);

  return (
    <div className="flex flex-col gap-4" data-slot="board-table">
      {groups.map((bucket) => (
        <GroupTable key={bucket.key} label={bucket.label} rows={bucket.rows} onOpen={onOpen} />
      ))}
    </div>
  );
}
