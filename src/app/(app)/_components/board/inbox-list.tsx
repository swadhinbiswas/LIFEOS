"use client";

import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/tui/empty-state";
import { controlGhost } from "@/components/tui/controls";
import type { BoardPayload } from "@/server/boards";

import { useBoard } from "./use-board";

const byPosition = (a: { position: string }, b: { position: string }) =>
  a.position < b.position ? -1 : 1;

const TRIAGE_COLUMNS = ["Today", "Upcoming", "Someday", "Done"];

/**
 * Inbox triage (spec §6.2): everything captured lands in Inbox; one click moves it to Today /
 * Upcoming / Someday / Done through the same versioned `moveCard` service a drag uses.
 *
 * The four destinations are ghost controls (ADR-117). They used to be four identical bordered
 * boxes on every row, which is the same defect the board toolbar had: at four per card the chrome
 * grows with the list, and the row's actual content — the title — is the quietest thing in it. The
 * arrow is the affordance, so the box was never carrying information.
 */
export function InboxList({
  boardId,
  initialData,
}: {
  boardId: string;
  initialData: BoardPayload;
}) {
  const { payload, isFetching, moveCard } = useBoard(boardId, initialData);
  const t = useTranslations("Pages.Inbox");

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

  if (cards.length === 0) {
    return <EmptyState title={t("emptyTitle")} hint={t("emptyHint")} testId="inbox-empty" />;
  }

  return (
    <div className="flex flex-col gap-1.5" data-slot="inbox-list">
      <p
        className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground"
        role="status"
        data-slot="inbox-count"
      >
        {t("count", { count: cards.length })}
        {isFetching ? t("syncing") : null}
      </p>
      <ul className="flex flex-col">
        {cards.map((card) => (
          <li
            key={card.id}
            data-slot="inbox-card"
            data-card-id={card.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border py-1.5 last:border-b-0"
          >
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{card.title}</span>
            {card.priority ? (
              <span className="font-mono text-[10px] text-warning uppercase">{card.priority}</span>
            ) : null}
            {card.due_at ? (
              <time
                dateTime={new Date(card.due_at).toISOString().slice(0, 10)}
                className="font-mono text-[10px] text-info tabular-nums"
              >
                {new Date(card.due_at).toISOString().slice(0, 10)}
              </time>
            ) : null}
            <span className="flex flex-wrap gap-x-2">
              {TRIAGE_COLUMNS.map((name) => {
                const column = payload.columns.find((candidate) => candidate.name === name);
                if (!column) return null;
                return (
                  <button
                    key={name}
                    type="button"
                    className={controlGhost}
                    onClick={() => triage(card, column.id)}
                    aria-label={t("moveAria", { title: card.title, name })}
                  >
                    {t("moveTo", { name })}
                  </button>
                );
              })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
