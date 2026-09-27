"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import {
  CALENDAR_VIEWS,
  monthGrid,
  monthLabel,
  monthOf,
  rangeFor,
  shiftMonth,
  weekDays,
  type CalendarView,
} from "@/server/calendar/grid";
import { shiftDay } from "@/server/habits/streak";
import type { BoardPayload, Card } from "@/server/boards";

import { chipState, controlGhost } from "@/components/tui/controls";

/**
 * Calendar view (spec §6.1): the board's dated cards on a month, week or agenda grid.
 *
 * **Days are the card's UTC day key, not the browser's.** A due date is authored in the card sheet
 * as a plain date and stored as UTC midnight (`datePatch`, ADR-015), and read back with the same
 * slice, so a card's day is exactly the day the user typed. Bucketing by a local timezone instead
 * would move every date one day west of UTC — the classic off-by-one that makes a calendar lose
 * trust. The `today` chip is the UTC day for the same reason: it has to compare against the keys
 * the dates were authored as.
 *
 * Cards with no due date cannot live on a grid, and dropping them would silently lose them from
 * this lens, so they collect in an "unscheduled" pile below it — one click from the same sheet.
 *
 * The month/week choice is local state rather than URL state: `?view=` already carries the lens,
 * and this is a zoom level inside it (like the kanban's scroll position), not a shareable query.
 */

const dayOf = (date: Date | null): string =>
  date ? new Date(date).toISOString().slice(0, 10) : "";

/** A due date is day-granular unless the user gave it a time; midnight means "no time". */
const timeOf = (date: Date | null): string | null => {
  if (!date) return null;
  const at = new Date(date);
  return at.getUTCHours() || at.getUTCMinutes() ? at.toISOString().slice(11, 16) : null;
};

function CardChip({ card, onOpen }: { card: Card; onOpen: (cardId: string) => void }) {
  const t = useTranslations("Pages.Board");
  const time = timeOf(card.due_at);
  return (
    <button
      type="button"
      data-slot="calendar-card"
      data-card-id={card.id}
      aria-label={t("openCard", { title: card.title })}
      title={card.title}
      onClick={() => onOpen(card.id)}
      className="flex w-full min-w-0 gap-1 border-l-2 border-l-info py-0.5 pl-1 text-left font-mono hover:bg-accent/50 focus-visible:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {time ? (
        <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">{time}</span>
      ) : null}
      <span className="line-clamp-2 min-w-0 flex-1 text-[10px] leading-tight">{card.title}</span>
    </button>
  );
}

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/** Two, like the calendar module: a third title is clipped by the cell and breaks the grid. */
const MONTH_CELL_LIMIT = 2;

export function CalendarView({
  payload,
  onOpen,
}: {
  payload: BoardPayload;
  onOpen: (cardId: string) => void;
}) {
  const t = useTranslations("Pages.Board");
  const tc = useTranslations("Pages.Calendar");
  const [range, setRange] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const today = new Date().toISOString().slice(0, 10);

  const { byDay, unscheduled } = useMemo(() => {
    const buckets = new Map<string, Card[]>();
    const undated: Card[] = [];
    for (const card of payload.cards) {
      if (!card.due_at) {
        undated.push(card);
        continue;
      }
      const key = dayOf(card.due_at);
      const bucket = buckets.get(key) ?? [];
      bucket.push(card);
      buckets.set(key, bucket);
    }
    return { byDay: buckets, unscheduled: undated };
  }, [payload.cards]);

  const step = (delta: number) =>
    setAnchor((current) =>
      range === "month"
        ? shiftMonth(current, delta)
        : shiftDay(current, range === "week" ? 7 * delta : 30 * delta),
    );

  const month = monthOf(anchor);
  const grid = monthGrid(anchor);
  const weeks: string[][] = [];
  for (let index = 0; index < grid.length; index += 7) weeks.push(grid.slice(index, index + 7));
  const week = weekDays(anchor);
  const agenda = rangeFor("agenda", anchor);
  const agendaDays = [...byDay.keys()]
    .filter((key) => key >= agenda.from && key <= agenda.to)
    .sort();

  const heading =
    range === "month"
      ? monthLabel(anchor)
      : range === "week"
        ? `${week[0]} → ${week[6]}`
        : `${agenda.from} → ${agenda.to}`;

  const openDay = (key: string) => {
    setAnchor(key);
    setRange("agenda");
  };

  return (
    <div className="flex flex-col gap-2" data-slot="board-calendar">
      <div className="flex flex-wrap items-center gap-2">
        <fieldset className="flex items-center gap-1">
          <legend className="sr-only">{t("view")}</legend>
          {CALENDAR_VIEWS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              aria-pressed={range === candidate}
              className={chipState(range === candidate)}
              onClick={() => setRange(candidate)}
            >
              {tc(candidate)}
            </button>
          ))}
        </fieldset>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={controlGhost}
            aria-label={tc("prev")}
            onClick={() => step(-1)}
          >
            ‹
          </button>
          <button type="button" className={controlGhost} onClick={() => setAnchor(today)}>
            {tc("today")}
          </button>
          <button
            type="button"
            className={controlGhost}
            aria-label={tc("next")}
            onClick={() => step(1)}
          >
            ›
          </button>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground" data-slot="calendar-heading">
          {heading}
        </p>
      </div>

      {range === "month" ? (
        <table className="w-full table-fixed border-collapse font-mono text-xs">
          <caption className="sr-only">{tc("monthView")}</caption>
          <thead>
            <tr>
              {WEEKDAY_KEYS.map((key) => (
                <th
                  key={key}
                  scope="col"
                  className="border border-border px-1 py-0.5 text-left text-[10px] text-muted-foreground uppercase"
                >
                  {tc(`weekdays.${key}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((row) => (
              <tr key={row[0]}>
                {row.map((key) => {
                  const cards = byDay.get(key) ?? [];
                  const shown = cards.slice(0, MONTH_CELL_LIMIT);
                  const hidden = cards.length - shown.length;
                  return (
                    <td
                      key={key}
                      data-day={key}
                      data-in-month={monthOf(key) === month ? "true" : "false"}
                      data-today={key === today ? "true" : undefined}
                      className={`h-20 border border-border p-1 align-top ${
                        monthOf(key) === month ? "" : "text-muted-foreground"
                      }`}
                    >
                      <span
                        className={
                          key === today
                            ? "inline-flex items-center rounded-[var(--radius)] bg-warning px-1 text-[10px] font-medium text-background tabular-nums"
                            : "text-[10px] tabular-nums"
                        }
                      >
                        {Number(key.slice(8))}
                      </span>
                      {key === today ? <span className="sr-only"> ({tc("today")})</span> : null}
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {shown.map((card) => (
                          <li key={card.id}>
                            <CardChip card={card} onOpen={onOpen} />
                          </li>
                        ))}
                        {hidden > 0 ? (
                          <li>
                            <button
                              type="button"
                              data-slot="calendar-more"
                              className="block pl-1 text-[10px] text-primary hover:underline"
                              onClick={() => openDay(key)}
                            >
                              {tc("more", { count: hidden })}
                            </button>
                          </li>
                        ) : null}
                      </ul>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {range === "week" ? (
        <table className="w-full table-fixed border-collapse font-mono text-xs">
          <caption className="sr-only">{tc("weekView")}</caption>
          <thead>
            <tr>
              {week.map((key) => (
                <th
                  key={key}
                  scope="col"
                  className="border border-border px-1 py-0.5 text-left text-[10px] text-muted-foreground"
                >
                  {key.slice(5)}
                  {key === today ? <span className="text-warning"> {tc("today")}</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {week.map((key) => (
                <td key={key} data-day={key} className="h-32 border border-border p-1 align-top">
                  <ul className="flex flex-col gap-0.5">
                    {(byDay.get(key) ?? []).map((card) => (
                      <li key={card.id}>
                        <CardChip card={card} onOpen={onOpen} />
                      </li>
                    ))}
                  </ul>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      ) : null}

      {range === "agenda" ? (
        agendaDays.length === 0 ? (
          <p data-slot="board-agenda-empty" className="font-mono text-xs text-muted-foreground">
            {tc("agendaEmpty", { from: agenda.from, to: agenda.to })}
          </p>
        ) : (
          <ul data-slot="board-agenda" className="flex flex-col gap-3">
            {agendaDays.map((key) => (
              <li key={key} data-day={key}>
                <h3 className="font-mono text-xs text-muted-foreground">
                  {key}
                  {key === today ? ` · ${tc("today")}` : ""}
                </h3>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {(byDay.get(key) ?? []).map((card) => (
                    <li key={card.id}>
                      <CardChip card={card} onOpen={onOpen} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {unscheduled.length > 0 ? (
        <section
          data-slot="calendar-unscheduled"
          aria-label={t("unscheduled")}
          className="flex flex-col gap-1 border-t border-border pt-2"
        >
          <h3 className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
            {t("unscheduled")} <span className="tabular-nums">{unscheduled.length}</span>
          </h3>
          <ul className="flex flex-wrap gap-1">
            {unscheduled.map((card) => (
              <li key={card.id}>
                <CardChip card={card} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
