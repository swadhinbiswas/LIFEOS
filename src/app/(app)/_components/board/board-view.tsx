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
import { useQueryState } from "nuqs";
import { useMemo, useState } from "react";

import {
  cardMatchesFilter,
  parseQuickFilters,
  serializeQuickFilters,
} from "@/config/board-filters";
import type { BoardPayload, Card } from "@/server/boards";

import { BoardColumn } from "./board-column";
import { BoardToolbar, type GroupBy } from "./board-toolbar";
import { CardSheet } from "./card-sheet";
import { type MoveDirection } from "./card-tile";
import { TableView } from "./table-view";
import { useBoard } from "./use-board";

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
}: {
  boardId: string;
  initialData: BoardPayload;
}) {
  const { payload, isFetching, moveCard, createCard, updateCard, removeCard } = useBoard(
    boardId,
    initialData,
  );
  const [viewParam, setViewParam] = useQueryState("view");
  const [query, setQuery] = useQueryState("q");
  const [filterParam, setFilterParam] = useQueryState("filter");
  const [groupParam, setGroupParam] = useQueryState("group");
  const [cardParam, setCardParam] = useQueryState("card");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const view = viewParam === "table" ? "table" : "kanban";
  const filters = useMemo(() => parseQuickFilters(filterParam), [filterParam]);
  const group: GroupBy = groupParam === "column" || groupParam === "priority" ? groupParam : "none";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const columns = payload.columns;
  const columnName = (columnId: string) =>
    columns.find((column) => column.id === columnId)?.name ?? "column";

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
    return `${index + 1} of ${siblings.length} in ${columnName(card.column_id)}`;
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

  return (
    <div className="flex flex-col gap-3">
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
                return card ? `Picked up ${card.title}. ${positionLabel(card)}.` : undefined;
              },
              onDragOver: ({ active, over }) => {
                const card = visibleCards.find((candidate) => candidate.id === String(active.id));
                if (!card || !over) return undefined;
                return `${card.title} is over ${columnName(String(over.id))}.`;
              },
              onDragEnd: ({ active, over }) => {
                const card = visibleCards.find((candidate) => candidate.id === String(active.id));
                if (!card) return undefined;
                return over
                  ? `Dropped ${card.title}. ${positionLabel(card)}.`
                  : `Dropped ${card.title}.`;
              },
              onDragCancel: ({ active }) => {
                const card = visibleCards.find((candidate) => candidate.id === String(active.id));
                return card ? `Cancelled moving ${card.title}.` : undefined;
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
