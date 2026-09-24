"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useState } from "react";

import type { BoardColumn as Column, Card } from "@/server/boards";
import { cn } from "@/lib/utils";

import { CardTile, type MoveDirection } from "./card-tile";

/**
 * One kanban column: droppable body, WIP meter (soft warning per spec §6.1), collapsible
 * header and a quick-add row that keeps focus so Enter adds another card.
 */
export function BoardColumn({
  column,
  cards,
  query,
  busy,
  onMove,
  onOpen,
  focusedCardId,
  onAdd,
}: {
  column: Column;
  cards: Card[];
  query: string;
  busy: boolean;
  onMove: (cardId: string, direction: MoveDirection) => void;
  onOpen?: (cardId: string) => void;
  focusedCardId?: string | null;
  onAdd: (columnId: string, title: string) => Promise<void> | void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { type: "column" } });
  const [collapsed, setCollapsed] = useState(false);
  const [title, setTitle] = useState("");

  const overLimit = column.wip_limit !== null && cards.length > column.wip_limit;
  const sorted = [...cards].sort((a, b) => (a.position < b.position ? -1 : 1));

  return (
    <section
      data-slot="board-column"
      data-column-id={column.id}
      data-column-name={column.name}
      className="flex w-64 shrink-0 flex-col border border-border bg-card"
      aria-label={column.name}
    >
      <header className="flex items-center gap-2 border-b border-border px-2 py-1.5">
        {column.glyph ? (
          <span aria-hidden="true" className="font-mono text-xs text-muted-foreground">
            {column.glyph}
          </span>
        ) : null}
        <h2 className="min-w-0 flex-1 truncate font-mono text-xs font-medium tracking-wider uppercase">
          {column.name}
        </h2>
        <span
          className={cn(
            "font-mono text-[10px] tabular-nums",
            overLimit ? "text-warning" : "text-muted-foreground",
          )}
          title={column.wip_limit !== null ? `WIP limit ${column.wip_limit}` : undefined}
        >
          {cards.length}
          {column.wip_limit !== null ? `/${column.wip_limit}` : ""}
        </span>
        <button
          type="button"
          className="font-mono text-xs text-muted-foreground hover:text-foreground"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? "+" : "−"}
        </button>
      </header>

      {!collapsed ? (
        <>
          <ul
            ref={setNodeRef}
            className={cn("flex min-h-16 flex-col gap-1 p-1", isOver && "bg-accent")}
          >
            <SortableContext
              items={sorted.map((card) => card.id)}
              strategy={verticalListSortingStrategy}
            >
              {sorted.map((card) => (
                <CardTile
                  key={card.id}
                  card={card}
                  query={query}
                  focused={card.id === focusedCardId}
                  onMove={onMove}
                  onOpen={onOpen}
                />
              ))}
            </SortableContext>
            {sorted.length === 0 ? (
              <li className="px-2 py-3 font-mono text-[10px] text-muted-foreground">no cards</li>
            ) : null}
          </ul>

          <form
            className="border-t border-border p-1"
            onSubmit={(event) => {
              event.preventDefault();
              const value = title.trim();
              if (!value) return;
              void onAdd(column.id, value);
              setTitle("");
            }}
          >
            <label className="sr-only" htmlFor={`add-${column.id}`}>
              add a card to {column.name}
            </label>
            <input
              id={`add-${column.id}`}
              data-new-item=""
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="+ add card"
              disabled={busy}
              className="w-full bg-transparent px-1 py-1 font-mono text-xs outline-none placeholder:text-muted-foreground"
            />
          </form>
        </>
      ) : null}
    </section>
  );
}
