import { and, desc, eq, isNull } from "drizzle-orm";

import { newId } from "@/lib/id";
import {
  DEFAULT_TIME_ZONE,
  dayKeyInTimeZone,
  startOfDayInTimeZone,
  startOfWeekInstant,
  type WeekStart,
} from "@/lib/timezone";
import { db } from "@/server/db";
import { focus_sessions } from "@/server/db/schema";

/**
 * Focus sessions (spec §6.7). A running session is simply a row with `ended_at IS NULL`, so the
 * timer survives navigation and a reload without any client-side persistence trick — every page
 * reads the same row. Totals are derived from completed sessions.
 */

export type FocusSession = typeof focus_sessions.$inferSelect;

const MINUTE_MS = 60_000;

export async function getRunningSession(userId: string): Promise<FocusSession | null> {
  const [row] = await db
    .select()
    .from(focus_sessions)
    .where(
      and(
        eq(focus_sessions.user_id, userId),
        isNull(focus_sessions.ended_at),
        eq(focus_sessions.kind, "focus"),
      ),
    )
    .orderBy(desc(focus_sessions.started_at))
    .limit(1);
  return row ?? null;
}

/** Start a session; any session already running is closed first, so there is at most one. */
export async function startSession(
  userId: string,
  input: { plannedMin?: number | null; cardId?: string | null; kind?: string } = {},
): Promise<FocusSession> {
  const running = await getRunningSession(userId);
  if (running) await stopSession(userId, running.id);

  const [row] = await db
    .insert(focus_sessions)
    .values({
      id: newId(),
      user_id: userId,
      card_id: input.cardId ?? null,
      started_at: new Date(),
      planned_min: input.plannedMin ?? null,
      kind: input.kind ?? "focus",
    })
    .returning();
  if (!row) throw new Error("focus session insert returned no row");
  return row;
}

/** Stop a session and record whether the planned block was actually reached. */
export async function stopSession(userId: string, sessionId: string): Promise<FocusSession> {
  const [existing] = await db
    .select()
    .from(focus_sessions)
    .where(and(eq(focus_sessions.id, sessionId), eq(focus_sessions.user_id, userId)))
    .limit(1);
  if (!existing) throw new Error("focus session not found");
  if (existing.ended_at) return existing;

  const endedAt = new Date();
  const minutes = Math.max(
    0,
    Math.round((endedAt.getTime() - new Date(existing.started_at).getTime()) / MINUTE_MS),
  );
  const [row] = await db
    .update(focus_sessions)
    .set({
      ended_at: endedAt,
      completed: existing.planned_min === null ? true : minutes >= existing.planned_min,
    })
    .where(and(eq(focus_sessions.id, sessionId), eq(focus_sessions.user_id, userId)))
    .returning();
  if (!row) throw new Error("focus session not found");
  return row;
}

export interface FocusTotals {
  /** Minutes actually focused today, in the user's local day as the app sees it. */
  todayMin: number;
  weekMin: number;
  sessionsToday: number;
}

export async function focusTotals(
  userId: string,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
  weekStart: WeekStart = "mon",
): Promise<FocusTotals> {
  const rows = await db
    .select()
    .from(focus_sessions)
    .where(eq(focus_sessions.user_id, userId))
    .orderBy(desc(focus_sessions.started_at))
    .limit(500);

  // Today is the user's day; the week begins on their chosen first day (ADR-057/058).
  const dayStart = startOfDayInTimeZone(dayKeyInTimeZone(now, timeZone), timeZone);
  const weekStartInstant = startOfWeekInstant(now, timeZone, weekStart);

  const minutesOf = (session: FocusSession): number =>
    session.ended_at
      ? Math.max(
          0,
          Math.round(
            (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) /
              MINUTE_MS,
          ),
        )
      : 0;

  let todayMin = 0;
  let weekMin = 0;
  let sessionsToday = 0;
  for (const session of rows) {
    if (session.kind !== "focus") continue;
    const started = new Date(session.started_at).getTime();
    if (started >= weekStartInstant.getTime()) weekMin += minutesOf(session);
    if (started >= dayStart.getTime()) {
      todayMin += minutesOf(session);
      sessionsToday += 1;
    }
  }

  return { todayMin, weekMin, sessionsToday };
}

export async function listSessions(userId: string, limit = 12): Promise<FocusSession[]> {
  return db
    .select()
    .from(focus_sessions)
    .where(eq(focus_sessions.user_id, userId))
    .orderBy(desc(focus_sessions.started_at))
    .limit(limit);
}
