"use client";

import { useEffect } from "react";

import type { BoardColumn, Card } from "@/server/boards";

import { RENDERED_VIEWS, VIEW_KEYS, type BoardView } from "@/config/boards";

const byPosition = (a: Card, b: Card) =>
  a.position < b.position ? -1 : a.position > b.position ? 1 : 0;

/** The view a `1`…`5` key selects, for the views that have a renderer. */
const viewForKey = (key: string): BoardView | null =>
  RENDERED_VIEWS.find((view) => VIEW_KEYS[view] === key) ?? null;

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
  onToggleSelect: (card: Card) => void;
  onClearSelection: () => void;
  hasSelection: boolean;
  onView: (view: BoardView) => void;
  /** Board history (spec §6.1): Ctrl+Z / Ctrl+Shift+Z. */
  onUndo: () => void;
  onRedo: () => void;
  /** Off in the table view, whose own controls handle the same concepts. */
  enabled: boolean;
}
/**
 * Board list keys (spec §4.3): `j`/`k` move focus, `h`/`l` cross columns, Enter opens the card,
 * Space toggles done, Shift+J/K reorder, Del deletes (with the standard undo toast), `1`…`5`
 * switch views, and Ctrl+Z / Ctrl+Shift+Z walk the history stack.
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
  onToggleSelect,
  onClearSelection,
  hasSelection,
  onView,
  onUndo,
  onRedo,
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

      // History works in either view and regardless of focus state.
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) onRedo();
        else onUndo();
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const flat = orderedCards(cards, columns);
      const viewKey = viewForKey(event.key);
      if (flat.length === 0) {
        // View keys still work on an empty board.
        if (viewKey) {
          event.preventDefault();
          onView(viewKey);
        }
        return;
      }
      const focused = focusedId ? (cards.find((card) => card.id === focusedId) ?? null) : null;
      const index = focused ? flat.findIndex((card) => card.id === focused.id) : -1;

      // View switches are always live (they work from the table and grid views too).
      if (viewKey) {
        event.preventDefault();
        onView(viewKey);
        return;
      }

      // Everything below is kanban-only.
      if (!enabled) return;

      // Escape clears a bulk selection before anything else consumes it.
      if (event.key === "Escape" && hasSelection) {
        event.preventDefault();
        onClearSelection();
        return;
      }

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
      if (event.key === "x") {
        event.preventDefault();
        onToggleSelect(focused);
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
    onToggleSelect,
    onClearSelection,
    hasSelection,
    onView,
    onUndo,
    onRedo,
    enabled,
  ]);
}
