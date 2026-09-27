"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import type { BoardPayload, Card } from "@/server/boards";

/**
 * Timeline / Gantt-lite view (spec §6.1): each dated card is a bar from its start to its due date,
 * on a day-granular axis, grouped by column and ordered the way the kanban orders cards.
 *
 * The window is derived from the data rather than chosen: it runs from the earliest date on the
 * board to the latest, padded by two days and widened to a minimum of two weeks so a single card
 * still reads as a position on a timeline rather than as a lone mark. That means the view never
 * hides a card behind a "next month" control nobody found.
 *
 * Days are UTC day keys, for the same reason the calendar view uses them (ADR-015): a date authored
 * in the card sheet is a plain date stored as UTC midnight, so bucketing locally would move it.
 *
 * A card with only one date is a milestone at that date. A card with no dates cannot be placed at
 * all, so it collects in the same "no due date" pile the calendar view uses.
 */

const DAY_MS = 86_400_000;
/** One day column, in px. Wide enough for a date label, narrow enough to see a month. */
const COL = 32;
const MIN_DAYS = 14;
const PAD_DAYS = 2;

const dayOf = (date: Date | null): string =>
  date ? new Date(date).toISOString().slice(0, 10) : "";

const dayIndex = (key: string): number => Math.round(Date.parse(`${key}T00:00:00.000Z`) / DAY_MS);
const dayKeyOf = (index: number): string => new Date(index * DAY_MS).toISOString().slice(0, 10);

interface Span {
  card: Card;
  /** Day indices, inclusive; equal for a milestone. */
  from: number;
  to: number;
}

function SpanButton({ span, onOpen }: { span: Span; onOpen: (cardId: string) => void }) {
  const t = useTranslations("Pages.Board");
  const days = span.to - span.from + 1;
  const milestone = span.from === span.to;
  const range =
    span.card.start_at && span.card.due_at
      ? `${dayOf(span.card.start_at)} → ${dayOf(span.card.due_at)}`
      : dayKeyOf(span.from);
  return (
    <button
      type="button"
      data-slot="timeline-bar"
      data-card-id={span.card.id}
      aria-label={t("openCard", { title: span.card.title })}
      title={`${span.card.title} · ${range}`}
      onClick={() => onOpen(span.card.id)}
      style={{
        left: span.from * COL,
        width: milestone ? Math.round(COL / 3) : days * COL,
      }}
      className="absolute top-1 h-4 rounded-sm border border-info bg-info/20 hover:bg-info/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    />
  );
}

export function TimelineView({
  payload,
  onOpen,
}: {
  payload: BoardPayload;
  onOpen: (cardId: string) => void;
}) {
  const t = useTranslations("Pages.Board");

  const { spans, unscheduled, days, today } = useMemo(() => {
    const dated: Span[] = [];
    const undated: Card[] = [];
    for (const card of payload.cards) {
      const start = card.start_at ? dayIndex(dayOf(card.start_at)) : null;
      const due = card.due_at ? dayIndex(dayOf(card.due_at)) : null;
      if (start === null && due === null) {
        undated.push(card);
        continue;
      }
      const a = start ?? due!;
      const b = due ?? start!;
      dated.push({ card, from: Math.min(a, b), to: Math.max(a, b) });
    }

    const window = dated.length
      ? (() => {
          const first = Math.min(...dated.map((span) => span.from)) - PAD_DAYS;
          const last = Math.max(...dated.map((span) => span.to)) + PAD_DAYS;
          return { first, last: Math.max(last, first + MIN_DAYS - 1) };
        })()
      : { first: dayIndex(new Date().toISOString().slice(0, 10)), last: 0 };
    const last = dated.length ? window.last : window.first + MIN_DAYS - 1;
    const keys: string[] = [];
    for (let index = window.first; index <= last; index += 1) keys.push(dayKeyOf(index));

    return {
      spans: dated,
      unscheduled: undated,
      days: keys,
      today: dayKeyOf(dayIndex(new Date().toISOString().slice(0, 10))),
    };
  }, [payload.cards]);

  const first = days.length ? dayIndex(days[0]!) : 0;

  return (
    <div className="flex flex-col gap-2" data-slot="board-timeline">
      {days.length === 0 ? (
        <p className="font-mono text-xs text-muted-foreground">{t("noCards")}</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-max">
            <div className="flex border-b border-border pb-0.5" data-slot="timeline-header">
              <div className="sticky left-0 z-10 w-48 shrink-0 bg-background" />
              {days.map((day) => (
                <div
                  key={day}
                  title={day}
                  data-day={day}
                  className={`shrink-0 text-center font-mono text-[10px] tabular-nums ${
                    day === today ? "text-warning" : "text-muted-foreground"
                  }`}
                  style={{ width: COL }}
                >
                  {day.slice(8)}
                </div>
              ))}
            </div>

            {payload.columns.map((column) => {
              const rows = spans
                .filter((span) => span.card.column_id === column.id)
                .sort((a, b) => a.from - b.from || a.to - b.to);
              if (rows.length === 0) return null;
              return (
                <section key={column.id} aria-label={column.name} className="flex flex-col">
                  <h3 className="sticky left-0 z-10 w-fit bg-background px-2 pt-2 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                    {column.name} <span className="tabular-nums">{rows.length}</span>
                  </h3>
                  <ul>
                    {rows.map((span) => (
                      <li
                        key={span.card.id}
                        className="flex items-center border-b border-border/40"
                        data-card-row={span.card.id}
                      >
                        <span className="sticky left-0 z-10 w-48 shrink-0 truncate bg-background px-2 font-mono text-[10px]">
                          {span.card.title}
                        </span>
                        <span className="relative h-6" style={{ width: days.length * COL }}>
                          {/* Weekly gridlines, drawn rather than laid out: a 200-day window would
                              otherwise be 200 extra elements per row. */}
                          <span
                            aria-hidden="true"
                            className="absolute inset-0"
                            style={{
                              backgroundImage:
                                "repeating-linear-gradient(to right, var(--border) 0 1px, transparent 1px 224px)",
                            }}
                          />
                          {days.includes(today) ? (
                            <span
                              aria-hidden="true"
                              className="absolute top-0 bottom-0 w-px bg-warning"
                              style={{ left: (dayIndex(today) - first) * COL }}
                            />
                          ) : null}
                          <SpanButton span={span} onOpen={onOpen} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {unscheduled.length > 0 ? (
        <section
          data-slot="timeline-unscheduled"
          aria-label={t("unscheduled")}
          className="flex flex-col gap-1 border-t border-border pt-2"
        >
          <h3 className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
            {t("unscheduled")} <span className="tabular-nums">{unscheduled.length}</span>
          </h3>
          <ul className="flex flex-wrap gap-1 font-mono text-[10px]">
            {unscheduled.map((card) => (
              <li key={card.id}>
                <button
                  type="button"
                  data-slot="timeline-undated"
                  data-card-id={card.id}
                  aria-label={t("openCard", { title: card.title })}
                  onClick={() => onOpen(card.id)}
                  className="border border-border bg-card px-1.5 py-0.5 hover:border-ring focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {card.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
