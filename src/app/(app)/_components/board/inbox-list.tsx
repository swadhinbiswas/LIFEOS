"use client";

import type { BoardPayload } from "@/server/boards";

import { useBoard } from "./use-board";

const byPosition = (a: { position: string }, b: { position: string }) =>
  a.position < b.position ? -1 : 1;

const TRIAGE_COLUMNS = ["Today", "Upcoming", "Someday", "Done"];

const control =
  "rounded-[var(--radius)] border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-foreground hover:bg-accent hover:text-accent-foreground";

/**
 * Inbox triage (spec §6.2): everything captured lands in Inbox; one click moves it to Today /
 * Upcoming / Someday / Done through the same versioned `moveCard` service a drag uses.
 */
export function InboxList({
  boardId,
  initialData,
}: {
  boardId: string;
  initialData: BoardPayload;
}) {
  const { payload, isFetching, moveCard } = useBoard(boardId, initialData);

  const inbox = payload.columns.find((column) => column.name === "Inbox");
  const cards = (inbox ? payload.cards.filter((card) => card.column_id === inbox.id) : []).sort(
    byPosition,
  );

  const triage = (card: { id: string; version: number }, toColumnId: string) => {
    const last = payload.cards
      .filter((candidate) => candidate.column_id === toColumnId)
      .sort(byPosition)
      .at(-1);
    moveCard.mutate({
      cardId: card.id,
      version: card.version,
      toColumnId,
      prevCardId: last?.id ?? null,
      nextCardId: null,
    });
  };

  return (
    <div className="flex flex-col gap-2" data-slot="inbox-list">
      {cards.length === 0 ? (
        <p className="font-mono text-xs text-muted-foreground">
          inbox is empty — capture something above
        </p>
      ) : null}

      <ul className="flex flex-col gap-1">
        {cards.map((card) => (
          <li
            key={card.id}
            data-slot="inbox-card"
            data-card-id={card.id}
            className="flex flex-wrap items-center gap-2 border border-border bg-card px-2 py-1"
          >
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{card.title}</span>
            {card.priority ? (
              <span className="font-mono text-[10px] text-warning uppercase">{card.priority}</span>
            ) : null}
            {card.due_at ? (
              <time
                dateTime={new Date(card.due_at).toISOString().slice(0, 10)}
                className="font-mono text-[10px] text-info"
              >
                {new Date(card.due_at).toISOString().slice(0, 10)}
              </time>
            ) : null}
            <span className="flex flex-wrap gap-1">
              {TRIAGE_COLUMNS.map((name) => {
                const column = payload.columns.find((candidate) => candidate.name === name);
                if (!column) return null;
                return (
                  <button
                    key={name}
                    type="button"
                    className={control}
                    onClick={() => triage(card, column.id)}
                    aria-label={`move ${card.title} to ${name}`}
                  >
                    → {name}
                  </button>
                );
              })}
            </span>
          </li>
        ))}
      </ul>

      <p className="font-mono text-[10px] text-muted-foreground" role="status">
        {cards.length} in inbox{isFetching ? " · syncing…" : ""}
      </p>
    </div>
  );
}
