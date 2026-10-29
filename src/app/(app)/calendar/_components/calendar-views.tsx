import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type { CalendarEvent, CalendarEventKind } from "@/server/calendar";
import { monthOf } from "@/server/calendar/grid";

/**
 * The three calendar views (spec §6.9 / #24, ADR-052), translated per ADR-072. All server-rendered:
 * a month table, a week table and an agenda list. Every event is a link back to the surface that
 * owns it, and "today" is a word as well as a position, so nothing depends on colour alone (§4.4).
 */

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/**
 * How many events a month cell draws before it defers to the agenda.
 *
 * Two, not three, and the screenshot is why: a title is allowed two lines, so two events plus the
 * date chip and the overflow link is 40 + 14 + 12 px inside an `h-20` (80 px) cell. Three overflows,
 * and the browser then clips the third title back to a single line — so the extra event bought a row
 * that stretched the grid *and* a truncated title. Two leaves every title its full two lines.
 */
const MONTH_CELL_LIMIT = 2;

function groupByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const bucket = byDay.get(event.date) ?? [];
    bucket.push(event);
    byDay.set(event.date, bucket);
  }
  return byDay;
}

/**
 * The kind, as a coloured rule down the left of the event rather than a word in front of it.
 *
 * Written out in full because a computed `border-l-${kind}` is invisible to Tailwind's scanner —
 * the class would never be generated, and the event would render with no rule at all. That failure
 * is invisible too, so the map is the safer shape.
 *
 * Chosen so the two that need a human are the two that stand out: an interview is a person waiting,
 * a subscription recurs, and a task is the ordinary case.
 */
const KIND_RULE: Record<CalendarEventKind, string> = {
  task: "border-l-info",
  interview: "border-l-warning",
  subscription: "border-l-primary",
  obligation: "border-l-destructive",
};

function EventLink({ event }: { event: CalendarEvent }) {
  return (
    <Link
      href={event.href}
      data-slot="calendar-event"
      data-kind={event.kind}
      // `min-w-0` is what lets the title shrink and wrap instead of pushing the rule out of the
      // cell; without it a flex child refuses to shrink below its content and the grid breaks.
      className={`flex min-w-0 gap-1 border-l-2 py-0.5 pl-1 hover:bg-accent/50 ${KIND_RULE[event.kind]}`}
      title={event.title}
    >
      {/* The category is still announced, and still reachable by a screen reader — it just stops
          spending the cell's scarce width on a word the colour already carries. */}
      <span className="sr-only">{event.kind}: </span>
      {event.time ? (
        <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
          {event.time}
        </span>
      ) : null}
      <span className="line-clamp-2 min-w-0 flex-1 text-[10px] leading-tight">{event.title}</span>
    </Link>
  );
}

export async function MonthView({
  anchor,
  today,
  days,
  events,
}: {
  anchor: string;
  today: string;
  days: string[];
  events: CalendarEvent[];
}) {
  const t = await getTranslations("Pages.Calendar");
  const byDay = groupByDay(events);
  const month = monthOf(anchor);
  const weeks: string[][] = [];
  for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7));

  return (
    <table className="w-full table-fixed border-collapse font-mono text-xs">
      <caption className="sr-only">{t("monthView")}</caption>
      <thead>
        <tr>
          {WEEKDAY_KEYS.map((key) => (
            <th
              key={key}
              scope="col"
              className="border border-border px-1 py-0.5 text-left text-[10px] text-muted-foreground uppercase"
            >
              {t(`weekdays.${key}`)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week) => (
          <tr key={week[0]}>
            {week.map((key) => {
              const inMonth = monthOf(key) === month;
              const dayEvents = byDay.get(key) ?? [];
              // A month cell is ~110px wide. Showing every event in it is how a busy day silently
              // stretches its row and breaks the grid the rest of the month depends on, so the cell
              // shows a fixed few and the rest are one click away in the agenda, which opens on that
              // day. Nothing is hidden without a way to it.
              const shown = dayEvents.slice(0, MONTH_CELL_LIMIT);
              const hidden = dayEvents.length - shown.length;
              return (
                <td
                  key={key}
                  data-day={key}
                  data-in-month={inMonth ? "true" : "false"}
                  data-today={key === today ? "true" : undefined}
                  className={`h-20 border border-border p-1 align-top ${inMonth ? "" : "text-muted-foreground"}`}
                >
                  {/* Today was a lowercase word in a warning colour, which is easy to miss in a
                      grid of 42 numbers. It is now a filled chip: findable at a glance, and still
                      carrying the word for anyone who does not see the fill. */}
                  <span
                    className={
                      key === today
                        ? "inline-flex items-center rounded-[var(--radius)] bg-warning px-1 text-[10px] font-medium text-background tabular-nums"
                        : "text-[10px] tabular-nums"
                    }
                  >
                    {Number(key.slice(8))}
                  </span>
                  {key === today ? <span className="sr-only"> ({t("today")})</span> : null}
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {shown.map((event) => (
                      <li key={event.id}>
                        <EventLink event={event} />
                      </li>
                    ))}
                    {hidden > 0 ? (
                      <li>
                        <Link
                          href={`/calendar?view=agenda&d=${key}`}
                          data-slot="calendar-more"
                          className="block pl-1 text-[10px] text-primary hover:underline"
                        >
                          {t("more", { count: hidden })}
                        </Link>
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
  );
}

export async function WeekView({
  days,
  today,
  events,
}: {
  days: string[];
  today: string;
  events: CalendarEvent[];
}) {
  const t = await getTranslations("Pages.Calendar");
  const byDay = groupByDay(events);
  return (
    <table className="w-full table-fixed border-collapse font-mono text-xs">
      <caption className="sr-only">{t("weekView")}</caption>
      <thead>
        <tr>
          {days.map((key) => (
            <th
              key={key}
              scope="col"
              className="border border-border px-1 py-0.5 text-left text-[10px] text-muted-foreground"
            >
              {key.slice(5)}
              {key === today ? <span className="text-warning"> {t("today")}</span> : null}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {days.map((key) => (
            <td key={key} data-day={key} className="h-32 border border-border p-1 align-top">
              <ul className="flex flex-col gap-0.5">
                {(byDay.get(key) ?? []).map((event) => (
                  <li key={event.id}>
                    <EventLink event={event} />
                  </li>
                ))}
              </ul>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

export async function AgendaView({
  from,
  to,
  today,
  events,
}: {
  from: string;
  to: string;
  today: string;
  events: CalendarEvent[];
}) {
  const t = await getTranslations("Pages.Calendar");
  const byDay = groupByDay(events);
  const days = [...byDay.keys()].sort();

  if (days.length === 0) {
    return (
      <p data-slot="agenda-empty" className="font-mono text-xs text-muted-foreground">
        {t("agendaEmpty", { from, to })}
      </p>
    );
  }

  return (
    <ul data-slot="agenda" className="flex flex-col gap-3">
      {days.map((key) => (
        <li key={key} data-day={key}>
          <h3 className="font-mono text-xs text-muted-foreground">
            {key}
            {key === today ? ` · ${t("today")}` : ""}
          </h3>
          <ul className="mt-1 flex flex-col gap-0.5 font-mono text-xs">
            {(byDay.get(key) ?? []).map((event) => (
              <li key={event.id}>
                <EventLink event={event} />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
