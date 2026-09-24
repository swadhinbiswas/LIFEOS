import Link from "next/link";
import { redirect } from "next/navigation";

import { Panel } from "@/components/tui/panel";
import { dayKeyInTimeZone } from "@/lib/timezone";
import { getServerSession } from "@/server/auth/session";
import { getCalendar } from "@/server/calendar";
import {
  CALENDAR_VIEWS,
  isValidDayKey,
  monthGrid,
  monthLabel,
  rangeFor,
  stepAnchor,
  weekDays,
  type CalendarView,
} from "@/server/calendar/grid";
import { getTimeZone } from "@/server/settings";

import { AgendaView, MonthView, WeekView } from "./_components/calendar-views";

export const metadata = { title: "Calendar" };

/** Plain-token controls only: opacity modifiers make axe sample pixels (ADR-041). */
const control =
  "rounded-[var(--radius)] border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-foreground hover:bg-accent hover:text-accent-foreground";
const activeControl =
  "rounded-[var(--radius)] border border-ring bg-accent px-2 py-0.5 font-mono text-[10px] text-accent-foreground";

type PageProps = { searchParams: Promise<{ view?: string; d?: string }> };

/**
 * `/calendar` (spec §6.9 / #24, ADR-052): month, week and agenda over every dated item, queried
 * one range at a time from the services that own the data. `?view=` and `?d=` mirror the board
 * views' URL-state rule, so a view is a shareable link.
 */
export default async function CalendarPage({ searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const { view, d } = await searchParams;
  const activeView: CalendarView = (CALENDAR_VIEWS as readonly string[]).includes(view ?? "")
    ? (view as CalendarView)
    : "month";
  const timeZone = await getTimeZone(session.user.id);
  const today = dayKeyInTimeZone(new Date(), timeZone);
  const anchor = isValidDayKey(d) ? d : today;
  const { from, to } = rangeFor(activeView, anchor);
  const events = await getCalendar(session.user.id, { from, to }, timeZone);

  const label = activeView === "month" ? monthLabel(anchor) : `${from} → ${to}`;
  const href = (nextView: CalendarView, day: string) => `/calendar?view=${nextView}&d=${day}`;

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">Calendar</h1>

      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <Link href={href(activeView, stepAnchor(activeView, anchor, -1))} className={control}>
            ← prev
          </Link>
          <Link href={href(activeView, today)} className={control}>
            today
          </Link>
          <Link href={href(activeView, stepAnchor(activeView, anchor, 1))} className={control}>
            next →
          </Link>
          <span data-slot="calendar-label" className="text-muted-foreground">
            {label}
          </span>
          <span className="ml-auto flex gap-1">
            {CALENDAR_VIEWS.map((candidate) => (
              <Link
                key={candidate}
                href={href(candidate, anchor)}
                aria-current={candidate === activeView ? "true" : undefined}
                className={candidate === activeView ? activeControl : control}
              >
                {candidate}
              </Link>
            ))}
          </span>
        </div>

        <Panel title={`${activeView} view`} hint={`${events.length} items`}>
          {activeView === "month" ? (
            <MonthView anchor={anchor} today={today} days={monthGrid(anchor)} events={events} />
          ) : activeView === "week" ? (
            <WeekView days={weekDays(anchor)} today={today} events={events} />
          ) : (
            <AgendaView from={from} to={to} today={today} events={events} />
          )}
        </Panel>
      </div>
    </>
  );
}
