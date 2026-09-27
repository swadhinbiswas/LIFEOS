"use client";

import { useTranslations } from "next-intl";

import type { BoardPayload, Card } from "@/server/boards";
import type { ChecklistProgress } from "@/server/boards/checklists";

/**
 * Grid view (spec §6.1): the same cards as square tiles, grouped by column, for the boards whose
 * cards are things you *look at* rather than steps you move — a portfolio, a job shortlist, a set of
 * covers. It is the fifth lens over one dataset, so it reads the same `payload` the kanban and the
 * table do and shares their quick filters and search; only the layout differs.
 *
 * Deliberately not a drop target: `?view=grid` is a browsing surface, and card changes belong to
 * the sheet it opens. That keeps the grid honest — every tile is one button, no nested controls, so
 * a keyboard user tabs through the gallery and opens exactly what they focused.
 */

const byPosition = (a: Card, b: Card) =>
  a.position < b.position ? -1 : a.position > b.position ? 1 : 0;

const dayLabel = (date: Date | null): string =>
  date ? new Date(date).toISOString().slice(0, 10) : "";

export function GridView({
  payload,
  onOpen,
  cardMeta,
  checklistProgress,
}: {
  payload: BoardPayload;
  onOpen: (cardId: string) => void;
  /** Extra chips per card (the job board passes company/excitement; the task board none). */
  cardMeta?: Record<string, Array<{ label: string }>>;
  /** Checklist progress per card, drawn on the tile (spec §6.1). */
  checklistProgress?: Record<string, ChecklistProgress>;
}) {
  const t = useTranslations("Pages.Board");

  return (
    <div className="flex flex-col gap-4" data-slot="board-grid">
      {payload.columns.map((column) => {
        const cards = payload.cards.filter((card) => card.column_id === column.id).sort(byPosition);
        return (
          <section key={column.id} aria-label={column.name} className="flex flex-col gap-2">
            <h2 className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
              {column.name} <span className="tabular-nums">{cards.length}</span>
            </h2>
            {cards.length === 0 ? (
              <p className="font-mono text-[10px] text-muted-foreground">{t("noCards")}</p>
            ) : (
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-2">
                {cards.map((card) => (
                  <li key={card.id}>
                    <button
                      type="button"
                      data-slot="grid-tile"
                      data-card-id={card.id}
                      aria-label={t("openCard", { title: card.title })}
                      onClick={() => onOpen(card.id)}
                      className="flex h-full w-full flex-col gap-1 rounded-[var(--radius)] border border-border bg-card p-2 text-left font-mono hover:border-ring focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-xs text-foreground">{card.title}</span>
                        {card.priority ? (
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {card.priority}
                          </span>
                        ) : null}
                      </span>

                      {card.description ? (
                        <span className="line-clamp-2 text-[10px] text-muted-foreground">
                          {card.description}
                        </span>
                      ) : null}

                      {cardMeta?.[card.id]?.length ? (
                        <span className="flex flex-wrap gap-x-2 text-[10px] text-muted-foreground">
                          {cardMeta[card.id]!.map((chip) => (
                            <span key={chip.label}>{chip.label}</span>
                          ))}
                        </span>
                      ) : null}

                      {/* Facts at the foot of the tile, so titles of different lengths still line
                          their metadata up across the row. */}
                      <span className="mt-auto flex flex-wrap items-center gap-x-2 pt-1 text-[10px] text-muted-foreground">
                        {card.completed_at ? <span>✓ {t("cardDone")}</span> : null}
                        {checklistProgress?.[card.id] ? (
                          <span className="tabular-nums" data-slot="grid-checklist-progress">
                            ▰ {checklistProgress[card.id]!.done}/{checklistProgress[card.id]!.total}
                          </span>
                        ) : null}
                        {card.due_at ? (
                          <span className="tabular-nums">{dayLabel(card.due_at)}</span>
                        ) : null}
                        {card.estimate_min ? (
                          <span className="tabular-nums">
                            {t("estimateMin", { minutes: card.estimate_min })}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
