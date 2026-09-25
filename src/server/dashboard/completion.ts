import { and, eq, gte } from "drizzle-orm";

import {
  DEFAULT_TIME_ZONE,
  dayKeyInTimeZone,
  shiftDayKey,
  startOfDayInTimeZone,
} from "@/lib/timezone";
import { db } from "@/server/db";
import { cards } from "@/server/db/schema";

/**
 * Card-completion history for the dashboard (spec §6.8, ADR-104).
 *
 * `completed_at` is stamped by the board engine when a card lands in a done column, so this is the
 * same truth the `tasksDoneThisWeek` KPI counts — one definition, two windows, exactly like the
 * focus series. Bucketing is by the user's own day key (ADR-057) and every day in the window is
 * present, with `0` for a quiet day, so a chart never has to invent a point.
 */

export interface CompletedDay {
  /** The user's local day key, `YYYY-MM-DD`. */
  day: string;
  /** Cards that reached a done column that day. */
  count: number;
  /** Whole cards' estimated minutes, so effort is visible next to output. */
  minutes: number;
}

const MIN_SERIES_DAYS = 1;
const MAX_SERIES_DAYS = 90;
/** Bounded read (ADR-099): a chart is a shape, not a ledger. */
const MAX_SERIES_ROWS = 5000;

export async function completedDailySeries(
  userId: string,
  days = 14,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): Promise<CompletedDay[]> {
  const window = Math.min(MAX_SERIES_DAYS, Math.max(MIN_SERIES_DAYS, Math.round(days)));
  const last = dayKeyInTimeZone(now, timeZone);
  const first = shiftDayKey(last, -(window - 1));

  const byDay = new Map<string, { count: number; minutes: number }>();
  for (let cursor = first; cursor <= last; cursor = shiftDayKey(cursor, 1)) {
    byDay.set(cursor, { count: 0, minutes: 0 });
  }

  // Indexed on (user_id, completed_at) — see the migration in ADR-104.
  const rows = await db
    .select({ completedAt: cards.completed_at, estimateMin: cards.estimate_min })
    .from(cards)
    .where(
      and(
        eq(cards.user_id, userId),
        gte(cards.completed_at, startOfDayInTimeZone(first, timeZone)),
      ),
    )
    .limit(MAX_SERIES_ROWS);

  for (const row of rows) {
    if (!row.completedAt) continue;
    const bucket = byDay.get(dayKeyInTimeZone(new Date(row.completedAt), timeZone));
    if (!bucket) continue;
    bucket.count += 1;
    bucket.minutes += row.estimateMin ?? 0;
  }

  return [...byDay].map(([day, bucket]) => ({ day, ...bucket }));
}
