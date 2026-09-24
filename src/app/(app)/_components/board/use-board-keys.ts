"use client";

import { useEffect } from "react";

import type { BoardColumn, Card } from "@/server/boards";

const byPosition = (a: Card, b: Card) =>
  a.position < b.position ? -1 : a.position > b.position ? 1 : 0;

/** Cards in reading order: columns left→right, cards top→bottom (spec §4.3 `j`/`k`). */
function orderedCards(cards: Card[], columns: BoardColumn[]): Card[] {
  const perColumn = new Map<string, Card[]>();
  for (const card of cards) {
    const bucket = perColumn.get(card.column_id) ?? [];
    bucket.push(card);
    perColumn.set(card.column_id, bucket);
  }
  return columns.flatMap((column) => (perColumn.get(column.id) ?? []).sort(byPosition));
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export interface BoardKeyHandlers {
  cards: Card[];
  columns: BoardColumn[];
  focusedId: string | null;
  setFocusedId: (id: string | null) => void;
  onOpen: (cardId: string) => void;
  onToggleComplete: (card: Card) => void;
  onReorder: (card: Card, direction: "up" | "down") => void;
  onDelete: (card: Card) => void;
  onView: (view: "kanban" | "table") => void;
  /** Off in the table view, whose own controls handle the same concepts. */
  enabled: boolean;
}
/**
 * Board list keys (spec §4.3): `j`/`k` move focus, `h`/`l` cross columns, Enter opens the card,
 * Space toggles done, Shift+J/K reorder, Del deletes (with the standard undo toast) and `1`/`2`
 * switch between the two views that exist.
 *
 * Every action delegates to the same service-backed mutation a drag or button uses.
 */
export function useBoardKeys({
  cards,
  columns,
  focusedId,
  setFocusedId,
  onOpen,
  onToggleComplete,
  onReorder,
  onDelete,
  onView,
  enabled,
}: BoardKeyHandlers): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const flat = orderedCards(cards, columns);
      if (flat.length === 0) {
        // View keys still work on an empty board.
        if (event.key === "1") {
          event.preventDefault();
          onView("table");
        } else if (event.key === "2") {
          event.preventDefault();
          onView("kanban");
        }
        return;
      }
      const focused = focusedId ? (cards.find((card) => card.id === focusedId) ?? null) : null;
      const index = focused ? flat.findIndex((card) => card.id === focused.id) : -1;

      // View switches are always live (they work from the table view too, which has no keys).
      if (event.key === "1") {
        event.preventDefault();
        onView("table");
        return;
      }
      if (event.key === "2") {
        event.preventDefault();
        onView("kanban");
        return;
      }

      // Everything below is kanban-only.
      if (!enabled) return;

      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        const next = flat[clamp(index + 1, 0, flat.length - 1)];
        if (next) setFocusedId(next.id);
        return;
      }
      if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        const previous = flat[clamp(index - 1, 0, flat.length - 1)];
        if (previous) setFocusedId(previous.id);
        return;
      }

      if (event.key === "h" || event.key === "l") {
        event.preventDefault();
        const columnIndex = focused
          ? columns.findIndex((column) => column.id === focused.column_id)
          : 0;
        const targetColumn =
          columns[clamp(columnIndex + (event.key === "l" ? 1 : -1), 0, columns.length - 1)];
        if (!targetColumn) return;
        const rowIndex = focused
          ? orderedCards(cards, columns)
              .filter((card) => card.column_id === focused.column_id)
              .findIndex((card) => card.id === focused.id)
          : 0;
        const targetCards = flat.filter((card) => card.column_id === targetColumn.id);
        const next = targetCards[clamp(rowIndex, 0, targetCards.length - 1)];
        if (next) setFocusedId(next.id);
        return;
      }

      if (!focused) return;

      if (event.key === "Enter") {
        event.preventDefault();
        onOpen(focused.id);
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        onToggleComplete(focused);
        return;
      }
      if (event.key === "J" || event.key === "K") {
        event.preventDefault();
        onReorder(focused, event.key === "J" ? "down" : "up");
        return;
      }
      if (event.key === "Delete") {
        event.preventDefault();
        onDelete(focused);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    cards,
    columns,
    focusedId,
    setFocusedId,
    onOpen,
    onToggleComplete,
    onReorder,
    onDelete,
    onView,
    enabled,
  ]);
}
