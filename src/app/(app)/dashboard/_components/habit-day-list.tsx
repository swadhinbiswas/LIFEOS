import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/tui/empty-state";
import type { HabitDayDetail } from "@/server/dashboard/habits";

/**
 * The day-by-day breakdown under the habit chart (ADR-130).
 *
 * A bar per day answers "am I keeping this up?" and nothing else. Twenty-eight bars at 60% each could
 * be the same three habits every day or a different two each time, and the chart cannot tell you
 * which — so the numbers people actually want ("what did I do on the 14th?") were somewhere else
 * entirely. This puts one row per day directly under the chart it explains.
 *
 * **Newest first.** The question this answers is almost always about recent days, and the row you
 * want is the one you did not have to scroll for. `Day N` counts from the oldest day in the window,
 * which is the only numbering that stays stable as the window slides.
 *
 * **Server-rendered on purpose.** It is a static table over rows the page already read; a client
 * component would ship the data twice and add a JS bundle to say nothing interactive.
 */
export async function HabitDayList({
  rows,
  totalHabits,
}: {
  rows: HabitDayDetail[];
  totalHabits: number;
}) {
  const t = await getTranslations("Pages.Dashboard");

  if (rows.length === 0) {
    return (
      <EmptyState title={t("dayListEmptyTitle")} hint={t("dayListEmptyHint")}>
        <Link
          href="/habits"
          className="rounded-[var(--radius)] border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
        >
          {t("dayListOpenHabits")}
        </Link>
      </EmptyState>
    );
  }

  return (
    <details className="mt-2" data-slot="habit-day-list">
      <summary className="flex min-h-7 cursor-pointer list-none items-center gap-1 rounded-[var(--radius)] px-1 font-mono text-[10px] tracking-wider text-muted-foreground uppercase hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <span aria-hidden="true" className="text-[9px]">
          ›
        </span>
        {t("dayListSummary", { count: rows.length })}
      </summary>

      <table className="mt-1 w-full font-mono text-[10px]">
        <caption className="sr-only">{t("dayListCaption")}</caption>
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground uppercase">
            {/* The category, on the left; the date, on the right — the same order the chart's axes
                read in, so the two line up when you look from one to the other. */}
            <th scope="col" className="px-2 py-1 font-normal">
              {t("dayListDay")}
            </th>
            <th scope="col" className="px-2 py-1 text-right font-normal">
              {t("dayListDone")}
            </th>
            <th scope="col" className="px-2 py-1 text-right font-normal">
              {t("dayListPercent")}
            </th>
            <th scope="col" className="px-2 py-1 text-right font-normal">
              {t("dayListDate")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows
            .slice()
            .reverse()
            .map((row) => (
              <tr
                key={row.day}
                className="border-b border-border/50 last:border-0"
                data-slot="day-row"
              >
                <th scope="row" className="px-2 py-1 text-left font-normal text-foreground">
                  {t("dayListDayN", { n: row.index })}
                </th>
                <td className="px-2 py-1 text-right tabular-nums">
                  {/* "0 of 4" rather than a bare 0: an empty day is a real answer, and a zero on its
                      own reads like a missing value. */}
                  {t("dayListOf", { done: row.done, total: totalHabits })}
                </td>
                <td className="px-2 py-1 text-right tabular-nums">
                  <span className={row.value === 0 ? "text-muted-foreground" : "text-foreground"}>
                    {row.value}%
                  </span>
                </td>
                {/* The full date on the right: `MM-DD` under the chart is ambiguous at a glance, and
                    this is the row somebody is comparing against a calendar. */}
                <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">
                  {row.day}
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      {/* The habit names, as a list under the table: a row can be four cells wide, and the names are
          the part that needs to wrap. Not a column, because that would make every row as tall as its
          longest habit name and the table unreadable. */}
      <ul className="mt-1 grid gap-0.5">
        {rows
          .slice()
          .reverse()
          .filter((row) => row.names.length > 0)
          .slice(0, 7)
          .map((row) => (
            <li key={row.day} className="flex gap-2 px-2 text-[10px] text-muted-foreground">
              <span className="shrink-0 tabular-nums">{row.day.slice(5)}</span>
              <span className="truncate">{row.names.join(", ")}</span>
            </li>
          ))}
      </ul>
    </details>
  );
}
