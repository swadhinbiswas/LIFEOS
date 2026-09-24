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
import { useState } from "react";

import type { BoardPayload, Card } from "@/server/boards";

import { BoardColumn } from "./board-column";
import { type MoveDirection } from "./card-tile";
import { useBoard } from "./use-board";

const byPosition = (a: Card, b: Card) =>
  a.position < b.position ? -1 : a.position > b.position ? 1 : 0;

/**
 * The one board surface (spec §6.1, ADR-042): kanban rendering over the board query, pointer
 * and keyboard drag sensors (ADR-016) plus explicit move buttons, and nuqs-owned URL state so
 * a filtered board is shareable.
 */
export function BoardView({
  boardId,
  initialData,
}: {
  boardId: string;
  initialData: BoardPayload;
}) {
  const { payload, isFetching, moveCard, createCard } = useBoard(boardId, initialData);
  const [query, setQuery] = useQueryState("q");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const columns = payload.columns;
  const cards = payload.cards;
  const columnName = (columnId: string) =>
    columns.find((column) => column.id === columnId)?.name ?? "column";
  const cardsInColumn = (columnId: string) =>
    cards.filter((card) => card.column_id === columnId).sort(byPosition);

  const positionLabel = (card: Card): string => {
    const siblings = cardsInColumn(card.column_id);
    const index = siblings.findIndex((candidate) => candidate.id === card.id);
    return `${index + 1} of ${siblings.length} in ${columnName(card.column_id)}`;
  };

  const activeCard = activeCardId ? (cards.find((card) => card.id === activeCardId) ?? null) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveCardId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCardId(null);
    const card = cards.find((candidate) => candidate.id === String(event.active.id));
    if (!card || !event.over) return;
    const overId = String(event.over.id);
    if (overId === card.id) return;

    const overCard = cards.find((candidate) => candidate.id === overId);
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
    const card = cards.find((candidate) => candidate.id === cardId);
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

  const filtered = (columnId: string) => {
    const inColumn = cardsInColumn(columnId);
    const needle = query?.trim().toLowerCase();
    if (!needle) return inColumn;
    return inColumn.filter((card) => card.title.toLowerCase().includes(needle));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <label className="sr-only" htmlFor="board-filter">
          filter cards by title
        </label>
        <input
          id="board-filter"
          value={query ?? ""}
          onChange={(event) => void setQuery(event.target.value === "" ? null : event.target.value)}
          placeholder="filter cards…"
          className="w-56 border border-border bg-background px-2 py-1 font-mono text-xs outline-none"
        />
        <p className="font-mono text-[10px] text-muted-foreground" role="status">
          {cards.length} card{cards.length === 1 ? "" : "s"}
          {isFetching ? " · syncing…" : ""}
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => {
              const card = cards.find((candidate) => candidate.id === String(active.id));
              return card ? `Picked up ${card.title}. ${positionLabel(card)}.` : undefined;
            },
            onDragOver: ({ active, over }) => {
              const card = cards.find((candidate) => candidate.id === String(active.id));
              if (!card || !over) return undefined;
              return `${card.title} is over ${columnName(String(over.id))}.`;
            },
            onDragEnd: ({ active, over }) => {
              const card = cards.find((candidate) => candidate.id === String(active.id));
              if (!card) return undefined;
              return over
                ? `Dropped ${card.title}. ${positionLabel(card)}.`
                : `Dropped ${card.title}.`;
            },
            onDragCancel: ({ active }) => {
              const card = cards.find((candidate) => candidate.id === String(active.id));
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
              cards={filtered(column.id)}
              query={query ?? ""}
              busy={isFetching}
              onMove={handleMove}
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
    </div>
  );
}
