"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import type { BoardColumn as Column, Card } from "@/server/boards";
import { cn } from "@/lib/utils";

import { CardTile, type MoveDirection } from "./card-tile";

/** Below this many cards a plain list is simpler; above it the column virtualizes. */
export const VIRTUALIZE_AFTER = 100;

/**
 * One kanban column: droppable body, WIP meter (soft warning per spec §6.1), collapsible
 * header and a quick-add row that keeps focus so Enter adds another card.
 *
 * Long columns virtualize with `@tanstack/react-virtual` (spec §6.1 "render 1,000+ cards
 * smoothly", Phase 2 acceptance at 500): only the visible rows mount, and dynamic measurement
 * keeps variable-height cards honest. The list is a `role="list"` of `role="listitem"` cards
 * so the virtualized wrapper stays valid markup.
 */
export function BoardColumn({
  column,
  cards,
  query,
  busy,
  onMove,
  onOpen,
  focusedCardId,
  selectedCardIds,
  cardMeta,
  onToggleSelect,
  onAdd,
}: {
  column: Column;
  cards: Card[];
  query: string;
  busy: boolean;
  onMove: (cardId: string, direction: MoveDirection) => void;
  onOpen?: (cardId: string) => void;
  focusedCardId?: string | null;
  selectedCardIds?: string[];
  cardMeta?: Record<string, Array<{ label: string; href?: string }>>;
  onToggleSelect?: (cardId: string) => void;
  onAdd: (columnId: string, title: string) => Promise<void> | void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { type: "column" } });
  const t = useTranslations("Pages.Board");
  const [collapsed, setCollapsed] = useState(false);
  const [title, setTitle] = useState("");

  const overLimit = column.wip_limit !== null && cards.length > column.wip_limit;
  const sorted = [...cards].sort((a, b) => (a.position < b.position ? -1 : 1));

  const listRef = useRef<HTMLUListElement | null>(null);
  const virtualize = sorted.length > VIRTUALIZE_AFTER;
  // TanStack Virtual returns functions that are intentionally not memoizable; the rule's
  // warning is a documented false positive for this API.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 84,
    overscan: 8,
    enabled: virtualize,
  });
  const virtualRows = virtualizer.getVirtualItems();

  const renderCard = (card: Card) => (
    <CardTile
      card={card}
      query={query}
      focused={card.id === focusedCardId}
      selected={selectedCardIds?.includes(card.id) ?? false}
      meta={cardMeta?.[card.id]}
      onMove={onMove}
      onOpen={onOpen}
      onToggleSelect={onToggleSelect}
    />
  );

  return (
    <section
      data-slot="board-column"
      data-column-id={column.id}
      data-column-name={column.name}
      className="flex min-w-64 max-w-[24rem] shrink-0 grow basis-64 snap-start flex-col rounded-[var(--radius)] border border-border bg-card"
      aria-label={column.name}
    >
      <header className="flex items-center gap-2 rounded-t-[var(--radius)] border-b border-border bg-background/60 px-2 py-1.5">
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
            "rounded-[var(--radius)] border border-border px-1 font-mono text-[10px] tabular-nums",
            overLimit ? "text-warning" : "text-muted-foreground",
          )}
          title={column.wip_limit !== null ? t("wipLimit", { limit: column.wip_limit }) : undefined}
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
            ref={(node) => {
              setNodeRef(node);
              listRef.current = node;
            }}
            data-virtualized={virtualize ? "true" : undefined}
            className={cn(
              "board-scroll flex max-h-[68vh] min-h-16 flex-col gap-1 overflow-y-auto p-1",
              isOver && "bg-accent",
            )}
          >
            <SortableContext
              items={sorted.map((card) => card.id)}
              strategy={verticalListSortingStrategy}
            >
              {virtualize ? (
                <li
                  style={{
                    height: virtualizer.getTotalSize(),
                    position: "relative",
                    width: "100%",
                    listStyle: "none",
                  }}
                >
                  {virtualRows.map((virtualRow) => {
                    const card = sorted[virtualRow.index];
                    if (!card) return null;
                    return (
                      <div
                        key={card.id}
                        data-index={virtualRow.index}
                        ref={virtualizer.measureElement}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          transform: `translateY(${virtualRow.start}px)`,
                          paddingBottom: "0.25rem",
                        }}
                      >
                        {renderCard(card)}
                      </div>
                    );
                  })}
                </li>
              ) : (
                sorted.map((card) => (
                  <li key={card.id} style={{ listStyle: "none" }}>
                    {renderCard(card)}
                  </li>
                ))
              )}
            </SortableContext>
            {sorted.length === 0 ? (
              <li
                style={{ listStyle: "none" }}
                className="px-2 py-3 font-mono text-[10px] text-muted-foreground"
              >
                {t("noCards")}
              </li>
            ) : null}
          </ul>

          <form
            method="post"
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
              {t("addCardTo", { name: column.name })}
            </label>
            <input
              id={`add-${column.id}`}
              data-new-item=""
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("addCard")}
              disabled={busy}
              className="w-full bg-transparent px-1 py-1 font-mono text-xs outline-none placeholder:text-muted-foreground"
            />
          </form>
        </>
      ) : null}
    </section>
  );
}
