import { and, eq, gte, isNull, lt, or } from "drizzle-orm";

import { DEFAULT_TIME_ZONE, dayKeyInTimeZone, startOfDayInTimeZone } from "@/lib/timezone";
import { db } from "@/server/db";
import {
  boards,
  cards,
  interviews,
  job_applications,
  subscriptions_tracked,
} from "@/server/db/schema";
import { shiftDay } from "@/server/habits/streak";

/**
 * Calendar events (spec §6.9 / #24, ADR-052). One queried range, gathered from the services that
 * own the data: cards with a due or start date, interviews, and subscription renewals. Habits and
 * focus sessions are deliberately out (they are records of what happened, not plans).
 */

export type CalendarEventKind = "task" | "interview" | "subscription";

export interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  title: string;
  /** ISO instant. */
  at: string;
  /** UTC day key `YYYY-MM-DD` (ADR-045). */
  date: string;
  /** `HH:MM` UTC for a timed item, null for a date-only one (stored at midnight UTC). */
  time: string | null;
  href: string;
}

export interface CalendarRange {
  from: string;
  to: string;
}

/**
 * An event's calendar day. Date-only values (stored at UTC midnight by the date inputs) keep their
 * UTC day — that is the day the user picked — while a timed value lands on the user's local day.
 */
const instantOf = (
  value: Date,
  timeZone: string,
): { at: string; date: string; time: string | null } => {
  const iso = value.toISOString();
  if (iso.endsWith("T00:00:00.000Z")) return { at: iso, date: iso.slice(0, 10), time: null };
  return { at: iso, date: dayKeyInTimeZone(value, timeZone), time: iso.slice(11, 16) };
};

/** Every dated item in the inclusive day range, bucketed in the user's timezone (ADR-057). */
export async function getCalendar(
  userId: string,
  range: CalendarRange,
  timeZone: string = DEFAULT_TIME_ZONE,
): Promise<CalendarEvent[]> {
  const from = startOfDayInTimeZone(range.from, timeZone);
  const to = startOfDayInTimeZone(shiftDay(range.to, 1), timeZone); // exclusive upper bound

  const [cardRows, interviewRows, subscriptionRows] = await Promise.all([
    db
      .select({
        id: cards.id,
        title: cards.title,
        dueAt: cards.due_at,
        startAt: cards.start_at,
        boardId: cards.board_id,
        isSystem: boards.is_system,
      })
      .from(cards)
      .innerJoin(boards, eq(cards.board_id, boards.id))
      .where(
        and(
          eq(cards.user_id, userId),
          isNull(cards.deleted_at),
          isNull(cards.archived_at),
          isNull(boards.deleted_at),
          or(
            and(gte(cards.due_at, from), lt(cards.due_at, to)),
            and(gte(cards.start_at, from), lt(cards.start_at, to)),
          ),
        ),
      ),
    db
      .select({
        id: interviews.id,
        kind: interviews.kind,
        startsAt: interviews.starts_at,
        cardId: job_applications.card_id,
        cardTitle: cards.title,
      })
      .from(interviews)
      .innerJoin(job_applications, eq(job_applications.id, interviews.job_application_id))
      .innerJoin(cards, eq(cards.id, job_applications.card_id))
      .where(
        and(
          eq(interviews.user_id, userId),
          gte(interviews.starts_at, from),
          lt(interviews.starts_at, to),
          isNull(cards.deleted_at),
          isNull(cards.archived_at),
        ),
      ),
    db
      .select({
        id: subscriptions_tracked.id,
        name: subscriptions_tracked.name,
        renewsAt: subscriptions_tracked.renews_at,
      })
      .from(subscriptions_tracked)
      .where(
        and(
          eq(subscriptions_tracked.user_id, userId),
          gte(subscriptions_tracked.renews_at, from),
          lt(subscriptions_tracked.renews_at, to),
        ),
      ),
  ]);

  const events: CalendarEvent[] = [];

  for (const row of cardRows) {
    // A card shows once: its due date wins, its start date is the fallback.
    const chosen = row.dueAt && row.dueAt >= from && row.dueAt < to ? row.dueAt : row.startAt;
    if (!chosen) continue;
    events.push({
      id: `task:${row.id}`,
      kind: "task",
      title: row.title,
      ...instantOf(chosen, timeZone),
      href: row.isSystem ? `/tasks?card=${row.id}` : `/boards/${row.boardId}?card=${row.id}`,
    });
  }

  for (const row of interviewRows) {
    if (!row.startsAt) continue;
    events.push({
      id: `interview:${row.id}`,
      kind: "interview",
      title: `${row.cardTitle} · ${row.kind}`,
      ...instantOf(row.startsAt, timeZone),
      href: `/career/jobs/${row.cardId}`,
    });
  }

  for (const row of subscriptionRows) {
    if (!row.renewsAt) continue;
    events.push({
      id: `subscription:${row.id}`,
      kind: "subscription",
      title: row.name,
      ...instantOf(row.renewsAt, timeZone),
      href: "/finance",
    });
  }

  return events.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}
