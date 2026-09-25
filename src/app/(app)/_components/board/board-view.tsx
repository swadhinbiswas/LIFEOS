"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";

import {
  cardMatchesFilter,
  parseQuickFilters,
  serializeQuickFilters,
} from "@/config/board-filters";
import type { BoardPayload, Card } from "@/server/boards";

import { BoardColumn } from "./board-column";
import { BoardToolbar, type GroupBy } from "./board-toolbar";
import { BoardUtils } from "./board-utils";
import { CardSheet } from "./card-sheet";
import { type MoveDirection } from "./card-tile";
import { SavedViews } from "./saved-views";
import { TableView } from "./table-view";
import { useBoardKeys } from "./use-board-keys";
import { useBoard } from "./use-board";
import { useUndoRedo } from "./use-undo-redo";

const byPosition = (a: Card, b: Card) =>
  a.position < b.position ? -1 : a.position > b.position ? 1 : 0;

/**
 * The one board surface (spec §6.1, ADR-042): kanban or table over the same query, with
 * pointer + keyboard drag sensors (ADR-016), explicit move buttons, and nuqs-owned URL state
 * (`?view=`, `?filter=`, `?group=`, `?q=`, `?card=`) so any board state is shareable.
 */
export function BoardView({
  boardId,
  initialData,
  cardMeta,
}: {
  boardId: string;
  initialData: BoardPayload;
  /** Extra chips per card (the job board passes company/excitement; the task board none). */
  cardMeta?: Record<string, Array<{ label: string; href?: string }>>;
}) {
  const { payload, isFetching, moveCard, createCard, updateCard, removeCard } = useBoard(
    boardId,
    initialData,
  );
  const t = useTranslations("Pages.Board");
  const { canUndo, canRedo, undo, redo, undoCount, redoCount } = useUndoRedo(boardId);
  const [viewParam, setViewParam] = useQueryState("view");
  const [query, setQuery] = useQueryState("q");
  const [filterParam, setFilterParam] = useQueryState("filter");
  const [groupParam, setGroupParam] = useQueryState("group");
  const [cardParam, setCardParam] = useQueryState("card");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const view = viewParam === "table" ? "table" : "kanban";
  const filters = useMemo(() => parseQuickFilters(filterParam), [filterParam]);
  const group: GroupBy = groupParam === "column" || groupParam === "priority" ? groupParam : "none";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const columns = payload.columns;
  const columnName = (columnId: string) =>
    columns.find((column) => column.id === columnId)?.name ?? t("columnFallback");

  const visibleCards = useMemo(() => {
    const needle = query?.trim().toLowerCase() ?? "";
    return payload.cards.filter((card) => {
      if (needle && !card.title.toLowerCase().includes(needle)) return false;
      return filters.every((filter) => cardMatchesFilter(card, filter));
    });
  }, [payload.cards, query, filters]);

  const cardsInColumn = (columnId: string) =>
    visibleCards.filter((card) => card.column_id === columnId).sort(byPosition);

  const openCard = cardParam ? (payload.cards.find((card) => card.id === cardParam) ?? null) : null;
  const activeCard = activeCardId
    ? (payload.cards.find((card) => card.id === activeCardId) ?? null)
    : null;

  const positionLabel = (card: Card): string => {
    const siblings = cardsInColumn(card.column_id);
    const index = siblings.findIndex((candidate) => candidate.id === card.id);
    return t("positionLabel", {
      index: index + 1,
      total: siblings.length,
      column: columnName(card.column_id),
    });
  };

  function handleDragStart(event: DragStartEvent) {
    setActiveCardId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCardId(null);
    const card = visibleCards.find((candidate) => candidate.id === String(event.active.id));
    if (!card || !event.over) return;
    const overId = String(event.over.id);
    if (overId === card.id) return;

    const overCard = visibleCards.find((candidate) => candidate.id === overId);
    const toColumnId =
      overCard?.column_id ?? (columns.some((c) => c.id === overId) ? overId : null);
    if (!toColumnId) return;

    const siblings = cardsInColumn(toColumnId).filter((candidate) => candidate.id !== card.id);
    let prevCardId: string | null = null;
    let nextCardId: string | null = null;
    if (overCard && overCard.id !== card.id) {
      const index = siblings.findIndex((candidate) => candidate.id === overCard.id);
      prevCardId = overCard.id;
      nextCardId = siblings[index + 1]?.id ?? null;
    } else {
      nextCardId = siblings[0]?.id ?? null; // dropped on the column body → top
    }

    moveCard.mutate({ cardId: card.id, version: card.version, toColumnId, prevCardId, nextCardId });
  }

  /** The non-drag keyboard path (ADR-016) — same service call as a drop. */
  function handleMove(cardId: string, direction: MoveDirection) {
    const card = visibleCards.find((candidate) => candidate.id === cardId);
    if (!card) return;
    const siblings = cardsInColumn(card.column_id);
    const index = siblings.findIndex((candidate) => candidate.id === cardId);

    if (direction === "up" || direction === "down") {
      const neighbour = siblings[direction === "up" ? index - 1 : index + 1];
      if (!neighbour) return;
      const prevCardId = direction === "up" ? (siblings[index - 2]?.id ?? null) : neighbour.id;
      const nextCardId = direction === "up" ? neighbour.id : (siblings[index + 2]?.id ?? null);
      moveCard.mutate({
        cardId,
        version: card.version,
        toColumnId: card.column_id,
        prevCardId,
        nextCardId,
      });
      return;
    }

    const columnIndex = columns.findIndex((column) => column.id === card.column_id);
    const targetColumn = columns[direction === "left" ? columnIndex - 1 : columnIndex + 1];
    if (!targetColumn) return;
    const targetCards = cardsInColumn(targetColumn.id);
    moveCard.mutate({
      cardId,
      version: card.version,
      toColumnId: targetColumn.id,
      prevCardId: targetCards.at(-1)?.id ?? null,
      nextCardId: null,
    });
  }

  const toggleFilter = (filter: (typeof filters)[number]) => {
    const next = filters.includes(filter)
      ? filters.filter((candidate) => candidate !== filter)
      : [...filters, filter];
    void setFilterParam(serializeQuickFilters(next));
  };

  /** The current URL state, captured by "save view" and replayed by "apply". */ const currentQuery =
    useMemo(() => {
      const state: Record<string, string> = {};
      if (viewParam === "table") state.view = "table";
      if (filterParam) state.filter = filterParam;
      if (groupParam) state.group = groupParam;
      if (query) state.q = query;
      return state;
    }, [viewParam, filterParam, groupParam, query]);

  const applyView = (state: Record<string, string>) => {
    void setViewParam(state.view === "table" ? "table" : null);
    void setFilterParam(state.filter ?? null);
    void setGroupParam(state.group ?? null);
    void setQuery(state.q ?? null);
  };

  /** Space toggles done: into the done column, or back to the first open one (spec §4.3). */ const toggleComplete =
    (card: Card) => {
      const done = columns.find((column) => column.is_done);
      const firstOpen = columns.find((column) => !column.is_done);
      const target = done && card.column_id !== done.id ? done : firstOpen;
      if (!target || target.id === card.column_id) return;
      moveCard.mutate({
        cardId: card.id,
        version: card.version,
        toColumnId: target.id,
        prevCardId: cardsInColumn(target.id).at(-1)?.id ?? null,
        nextCardId: null,
      });
    };

  const toggleSelect = (cardId: string) =>
    setSelectedIds((current) =>
      current.includes(cardId) ? current.filter((id) => id !== cardId) : [...current, cardId],
    );

  /** Bulk moves are sequential and chain their predecessors, so order is deterministic. */
  const bulkMove = async (toColumnId: string) => {
    let previousId: string | null = cardsInColumn(toColumnId).at(-1)?.id ?? null;
    for (const cardId of selectedIds) {
      const card = payload.cards.find((candidate) => candidate.id === cardId);
      if (!card) continue;
      await moveCard.mutateAsync({
        cardId,
        version: card.version,
        toColumnId,
        prevCardId: previousId,
        nextCardId: null,
      });
      previousId = cardId;
    }
    setSelectedIds([]);
  };

  const bulkRemove = async (archive: boolean) => {
    for (const cardId of selectedIds) await removeCard.mutateAsync({ cardId, archive });
    setSelectedIds([]);
  };

  useBoardKeys({
    cards: visibleCards,
    columns,
    focusedId,
    setFocusedId,
    onOpen: (cardId) => void setCardParam(cardId),
    onToggleComplete: toggleComplete,
    onReorder: (card, direction) => handleMove(card.id, direction),
    onDelete: (card) => removeCard.mutate({ cardId: card.id }),
    onToggleSelect: (card) => toggleSelect(card.id),
    onClearSelection: () => setSelectedIds([]),
    hasSelection: selectedIds.length > 0,
    onView: (next) => void setViewParam(next === "kanban" ? null : "table"),
    onUndo: undo,
    onRedo: redo,
    enabled: view === "kanban",
  });

  // Move real focus with the keyboard focus, so screen readers follow and the card is visible.
  useEffect(() => {
    if (!focusedId) return;
    const element = document.querySelector<HTMLElement>(`[data-card-id="${focusedId}"]`);
    if (!element) return;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [focusedId]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <BoardToolbar
        view={view}
        onView={(next) => void setViewParam(next === "kanban" ? null : next)}
        filters={filters}
        onToggleFilter={toggleFilter}
        group={group}
        onGroup={(next) => void setGroupParam(next === "none" ? null : next)}
        query={query ?? ""}
        onQuery={(value) => void setQuery(value === "" ? null : value)}
        count={visibleCards.length}
        syncing={isFetching}
        showGroup={view === "table"}
      />

      <SavedViews
        scope={payload.board.is_system ? "tasks" : "board"}
        current={currentQuery}
        onApply={applyView}
      />

      <BoardUtils boardId={boardId} />

      <div className="flex flex-wrap items-center gap-1 font-mono text-[10px]">
        <button
          type="button"
          data-slot="undo"
          data-undo-count={undoCount}
          disabled={!canUndo}
          onClick={undo}
          className="rounded-[var(--radius)] border border-border bg-background px-2 py-0.5 text-foreground hover:bg-accent hover:text-accent-foreground disabled:text-muted-foreground"
        >
          {t("undoButton")}
        </button>
        <button
          type="button"
          data-slot="redo"
          data-redo-count={redoCount}
          disabled={!canRedo}
          onClick={redo}
          className="rounded-[var(--radius)] border border-border bg-background px-2 py-0.5 text-foreground hover:bg-accent hover:text-accent-foreground disabled:text-muted-foreground"
        >
          {t("redoButton")}
        </button>
      </div>

      {selectedIds.length > 0 ? (
        <div
          data-slot="bulk-bar"
          className="flex flex-wrap items-center gap-2 border border-border bg-card px-2 py-1 font-mono text-[10px]"
        >
          <span role="status">{t("selected", { count: selectedIds.length })}</span>
          <label htmlFor="bulk-move">{t("moveTo")}</label>
          <select
            id="bulk-move"
            value=""
            onChange={(event) => {
              if (event.target.value) void bulkMove(event.target.value);
            }}
            className="border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
          >
            <option value="">{t("choose")}</option>
            {columns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-[var(--radius)] border border-border bg-background px-2 py-0.5 hover:bg-accent hover:text-accent-foreground"
            onClick={() => void bulkRemove(true)}
          >
            {t("archive")}
          </button>
          <button
            type="button"
            className="rounded-[var(--radius)] border border-border bg-background px-2 py-0.5 hover:bg-accent hover:text-accent-foreground"
            onClick={() => void bulkRemove(false)}
          >
            {t("delete")}
          </button>
          <button
            type="button"
            className="rounded-[var(--radius)] border border-border bg-background px-2 py-0.5 hover:bg-accent hover:text-accent-foreground"
            onClick={() => setSelectedIds([])}
          >
            {t("clear")}
          </button>
        </div>
      ) : null}

      {view === "table" ? (
        <TableView
          payload={{ ...payload, cards: visibleCards }}
          group={group}
          onOpen={(cardId) => void setCardParam(cardId)}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          accessibility={{
            announcements: {
              onDragStart: ({ active }) => {
                const card = visibleCards.find((candidate) => candidate.id === String(active.id));
                return card
                  ? t("pickedUp", { title: card.title, position: positionLabel(card) })
                  : undefined;
              },
              onDragOver: ({ active, over }) => {
                const card = visibleCards.find((candidate) => candidate.id === String(active.id));
                if (!card || !over) return undefined;
                return t("isOver", { title: card.title, column: columnName(String(over.id)) });
              },
              onDragEnd: ({ active, over }) => {
                const card = visibleCards.find((candidate) => candidate.id === String(active.id));
                if (!card) return undefined;
                return over
                  ? t("dropped", { title: card.title, position: positionLabel(card) })
                  : t("droppedNoPosition", { title: card.title });
              },
              onDragCancel: ({ active }) => {
                const card = visibleCards.find((candidate) => candidate.id === String(active.id));
                return card ? t("cancelled", { title: card.title }) : undefined;
              },
            },
          }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveCardId(null)}
        >
          <div className="flex gap-3 overflow-x-auto pb-2" data-slot="board">
            {columns.map((column) => (
              <BoardColumn
                key={column.id}
                column={column}
                cards={cardsInColumn(column.id)}
                query={query ?? ""}
                busy={isFetching}
                onMove={handleMove}
                onOpen={(cardId) => void setCardParam(cardId)}
                focusedCardId={focusedId}
                selectedCardIds={selectedIds}
                cardMeta={cardMeta}
                onToggleSelect={toggleSelect}
                onAdd={(columnId, title) => {
                  createCard.mutate({ columnId, title });
                }}
              />
            ))}
          </div>
          <DragOverlay>
            {activeCard ? (
              <div className="border border-ring bg-background px-2 py-1 font-mono text-xs">
                {activeCard.title}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {openCard ? (
        <CardSheet
          key={openCard.id}
          card={openCard}
          onOpenChange={(open) => {
            if (!open) void setCardParam(null);
          }}
          onUpdate={(vars) => updateCard.mutate(vars)}
          onArchive={(cardId) => {
            void setCardParam(null);
            removeCard.mutate({ cardId, archive: true });
          }}
          onDelete={(cardId) => {
            void setCardParam(null);
            removeCard.mutate({ cardId });
          }}
        />
      ) : null}
    </div>
  );
}
