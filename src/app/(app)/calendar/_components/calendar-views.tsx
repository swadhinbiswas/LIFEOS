import Link from "next/link";

import type { CalendarEvent } from "@/server/calendar";
import { monthOf, WEEKDAYS } from "@/server/calendar/grid";

/**
 * The three calendar views (spec §6.9 / #24, ADR-052). All server-rendered: a month table, a week
 * table and an agenda list. Every event is a link back to the surface that owns it, and "today" is
 * a word as well as a position, so nothing depends on colour alone (§4.4).
 */

function groupByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const bucket = byDay.get(event.date) ?? [];
    bucket.push(event);
    byDay.set(event.date, bucket);
  }
  return byDay;
}

function EventLink({ event }: { event: CalendarEvent }) {
  return (
    <Link
      href={event.href}
      data-slot="calendar-event"
      data-kind={event.kind}
      className="block truncate hover:underline"
      title={event.title}
    >
      <span className="text-muted-foreground">{event.kind}</span>{" "}
      {event.time ? <span className="text-info tabular-nums">{event.time}</span> : null}{" "}
      <span>{event.title}</span>
    </Link>
  );
}

export function MonthView({
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
  const byDay = groupByDay(events);
  const month = monthOf(anchor);
  const weeks: string[][] = [];
  for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7));

  return (
    <table className="w-full table-fixed border-collapse font-mono text-xs">
      <caption className="sr-only">Month view</caption>
      <thead>
        <tr>
          {WEEKDAYS.map((day) => (
            <th
              key={day}
              scope="col"
              className="border border-border px-1 py-0.5 text-left text-[10px] text-muted-foreground uppercase"
            >
              {day}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week) => (
          <tr key={week[0]}>
            {week.map((key) => {
              const inMonth = monthOf(key) === month;
              return (
                <td
                  key={key}
                  data-day={key}
                  data-in-month={inMonth ? "true" : "false"}
                  className={`h-20 border border-border p-1 align-top ${inMonth ? "" : "text-muted-foreground"}`}
                >
                  <span className="text-[10px] tabular-nums">{Number(key.slice(8))}</span>
                  {key === today ? <span className="ml-1 text-warning">today</span> : null}
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {(byDay.get(key) ?? []).map((event) => (
                      <li key={event.id}>
                        <EventLink event={event} />
                      </li>
                    ))}
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

export function WeekView({
  days,
  today,
  events,
}: {
  days: string[];
  today: string;
  events: CalendarEvent[];
}) {
  const byDay = groupByDay(events);
  return (
    <table className="w-full table-fixed border-collapse font-mono text-xs">
      <caption className="sr-only">Week view</caption>
      <thead>
        <tr>
          {days.map((key) => (
            <th
              key={key}
              scope="col"
              className="border border-border px-1 py-0.5 text-left text-[10px] text-muted-foreground"
            >
              {key.slice(5)}
              {key === today ? <span className="text-warning"> today</span> : null}
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

export function AgendaView({
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
  const byDay = groupByDay(events);
  const days = [...byDay.keys()].sort();

  if (days.length === 0) {
    return (
      <p data-slot="agenda-empty" className="font-mono text-xs text-muted-foreground">
        nothing scheduled between {from} and {to}
      </p>
    );
  }

  return (
    <ul data-slot="agenda" className="flex flex-col gap-3">
      {days.map((key) => (
        <li key={key} data-day={key}>
          <h3 className="font-mono text-xs text-muted-foreground">
            {key}
            {key === today ? " · today" : ""}
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
