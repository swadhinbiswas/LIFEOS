"use client";

import {
  createSortedRowModel,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import { useMemo } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  const t = useTranslations("Pages.Board");
  const columns = useMemo<Array<ColumnDef<typeof features, Row>>>(
    () => [
      { accessorKey: "title", header: t("tableCard") },
      { accessorKey: "columnName", header: t("tableColumn") },
      {
        accessorKey: "priority",
        header: t("tablePriority"),
        cell: (info) => info.row.original.priority,
      },
      {
        accessorKey: "due",
        header: t("tableDue"),
        cell: (info) => info.row.original.dueLabel,
      },
      {
        accessorKey: "estimate",
        header: t("tableEstimate"),
        cell: (info) => (info.row.original.estimate === 0 ? "" : info.row.original.estimate),
      },
    ],
    [t],
  );
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
      <Table className="font-mono text-xs">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  scope="col"
                  className="font-medium tracking-wider text-muted-foreground uppercase"
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
                </TableHead>
              ))}
              <TableHead className="w-10" />
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} data-slot="table-row" data-card-id={row.original.id}>
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id}>
                  {cell.column.id === "title" ? (
                    <span className="flex items-center gap-2">
                      <Avatar className="size-5">
                        <AvatarFallback className="font-mono text-[10px]">
                          {(row.original.title.trim()[0] ?? "·").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <button
                        type="button"
                        className="text-left hover:text-primary"
                        onClick={() => onOpen(row.original.id)}
                      >
                        <table.FlexRender cell={cell} />
                      </button>
                    </span>
                  ) : (
                    <table.FlexRender cell={cell} />
                  )}
                </TableCell>
              ))}
              <TableCell className="w-10 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${t("openCard", { title: row.original.title })}`}
                      data-slot="row-menu"
                    >
                      <MoreHorizontal aria-hidden="true" className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onOpen(row.original.id)}>
                      {t("open")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
  const t = useTranslations("Pages.Board");
  const groups = useMemo(() => {
    const rows = payload.cards.map((card) => toRow(card, payload));
    if (group === "none") return [{ key: "all", label: t("allCards"), rows }];

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
  }, [payload, group, t]);

  return (
    <div className="flex flex-col gap-4" data-slot="board-table">
      {groups.map((bucket) => (
        <GroupTable key={bucket.key} label={bucket.label} rows={bucket.rows} onOpen={onOpen} />
      ))}
    </div>
  );
}
