import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { cn } from "cn";

import { controlBoxed } from "@/components/tui/controls";
import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
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

import { pageMetadata } from "@/lib/page-metadata";

export async function generateMetadata() {
  return pageMetadata("Pages.Calendar", "title");
}

/** Plain-token controls only: opacity modifiers make axe sample pixels (ADR-041). */
// Both are the boxed tier from the shared vocabulary, so they carry its 24px floor and its
// focus-visible ring. The active variant only changes the fill and border colour, which keeps the
// two states the same size — a tab that resizes when you select it is a tab that moves under the
// pointer (ADR-117).
const control = controlBoxed;
const activeControl = cn(
  controlBoxed,
  "border-ring bg-accent text-accent-foreground hover:border-ring",
);

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
  const t = await getTranslations("Pages.Calendar");
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
      <PageHeader title={t("title")} count={events.length}>
        <a
          href="/api/v1/export?format=ics"
          download="lifeos.ics"
          data-slot="calendar-export"
          className={control}
        >
          {t("exportIcs")}
        </a>
      </PageHeader>

      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <Link href={href(activeView, stepAnchor(activeView, anchor, -1))} className={control}>
            {t("prev")}
          </Link>
          <Link href={href(activeView, today)} className={control}>
            {t("today")}
          </Link>
          <Link href={href(activeView, stepAnchor(activeView, anchor, 1))} className={control}>
            {t("next")}
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
                {t(candidate)}
              </Link>
            ))}
          </span>
        </div>

        <Panel
          title={t("viewPanel", { view: t(activeView) })}
          hint={t("items", { count: events.length })}
        >
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
