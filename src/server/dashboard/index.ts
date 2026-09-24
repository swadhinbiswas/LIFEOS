import { and, count, eq, gte, inArray, isNotNull, isNull, lt } from "drizzle-orm";

import { db } from "@/server/db";
import {
  budgets,
  cards,
  focus_sessions,
  goals,
  habit_logs,
  habits,
  transactions,
} from "@/server/db/schema";
import { ensureJobBoard } from "@/server/career";
import { getBoard } from "@/server/boards";
import { dayKey } from "@/server/habits/streak";

import { computeKpis, type KpiValue } from "./kpis";

/**
 * Dashboard service (spec §6.8): the numbers behind the KPI cards. It only reads — every value is
 * derived from the module that owns it, and each KPI carries a link to its filtered list (see
 * `KPI_DEFINITIONS`), so a dashboard is a view of the data, never a second copy of it.
 *
 * Deltas are reported only where history supports them: completed cards, focus minutes and habit
 * check-ins are timestamped, so a previous period exists; open applications, active goals and the
 * remaining budget are snapshots and say so instead of inventing a baseline.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfWeek = (date: Date): Date => {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7)); // Monday
  return day;
};

export interface DashboardKpis {
  values: KpiValue[];
  /** The window the deltas compare against, for the page's caption. */
  weekStart: string;
}

export async function getDashboardKpis(
  userId: string,
  now: Date = new Date(),
): Promise<DashboardKpis> {
  const thisWeek = startOfWeek(now);
  const lastWeek = new Date(thisWeek.getTime() - 7 * DAY_MS);

  const jobBoard = await ensureJobBoard(userId);
  const jobPayload = await getBoard(userId, jobBoard.id);
  const terminal = new Set(["Accepted", "Rejected", "Withdrawn"]);
  const openApplications = jobPayload.columns
    .filter((column) => !terminal.has(column.name))
    .map((column) => column.id);
  const openApplicationCards =
    openApplications.length === 0
      ? 0
      : ((
          await db
            .select({ value: count() })
            .from(cards)
            .where(
              and(
                eq(cards.user_id, userId),
                isNull(cards.deleted_at),
                inArray(cards.column_id, openApplications),
              ),
            )
        )[0]?.value ?? 0);

  const [completedThisWeek, completedLastWeek, openGoalCount, habitCount, habitLogsWeek] =
    await Promise.all([
      db
        .select({ value: count() })
        .from(cards)
        .where(and(eq(cards.user_id, userId), gte(cards.completed_at, thisWeek)))
        .then((rows) => rows[0]?.value ?? 0),
      db
        .select({ value: count() })
        .from(cards)
        .where(
          and(
            eq(cards.user_id, userId),
            gte(cards.completed_at, lastWeek),
            lt(cards.completed_at, thisWeek),
          ),
        )
        .then((rows) => rows[0]?.value ?? 0),
      db
        .select({ value: count() })
        .from(goals)
        .where(and(eq(goals.user_id, userId), eq(goals.status, "active")))
        .then((rows) => rows[0]?.value ?? 0),
      db
        .select({ value: count() })
        .from(habits)
        .where(eq(habits.user_id, userId))
        .then((rows) => rows[0]?.value ?? 0),
      db
        .select({ date: habit_logs.date })
        .from(habit_logs)
        .where(and(eq(habit_logs.user_id, userId), gte(habit_logs.date, dayKey(lastWeek)))),
    ]);

  const habitLogsThisWeek = habitLogsWeek.filter((row) => row.date >= dayKey(thisWeek)).length;
  const habitLogsLastWeek = habitLogsWeek.length - habitLogsThisWeek;

  const focusRows = await db
    .select({ startedAt: focus_sessions.started_at, endedAt: focus_sessions.ended_at })
    .from(focus_sessions)
    .where(
      and(
        eq(focus_sessions.user_id, userId),
        eq(focus_sessions.kind, "focus"),
        isNotNull(focus_sessions.ended_at),
        gte(focus_sessions.started_at, lastWeek),
      ),
    );
  const minutesSince = (from: Date, to: Date): number =>
    focusRows
      .filter((row) => {
        const started = new Date(row.startedAt).getTime();
        return started >= from.getTime() && started < to.getTime();
      })
      .reduce(
        (total, row) =>
          total +
          Math.max(
            0,
            Math.round(
              (new Date(row.endedAt ?? row.startedAt).getTime() -
                new Date(row.startedAt).getTime()) /
                60_000,
            ),
          ),
        0,
      );

  const budgetRows = await db.select().from(budgets).where(eq(budgets.user_id, userId));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthSpend = await db
    .select({ amountMinor: transactions.amount_minor })
    .from(transactions)
    .where(
      and(
        eq(transactions.user_id, userId),
        lt(transactions.amount_minor, 0),
        gte(transactions.occurred_at, monthStart),
      ),
    );
  const limits = budgetRows.reduce((total, row) => total + row.limit_minor, 0);
  const spent = monthSpend.reduce((total, row) => total + Math.abs(row.amountMinor), 0);

  const values = computeKpis({
    completedThisWeek,
    completedLastWeek,
    focusMinutesThisWeek: minutesSince(thisWeek, now),
    focusMinutesLastWeek: minutesSince(lastWeek, thisWeek),
    habitLogsThisWeek,
    habitLogsLastWeek,
    habitCount,
    activeGoals: openGoalCount,
    // Snapshots: no baseline exists, so no delta is claimed.
    activeGoalsLastWeek: null,
    openApplications: openApplicationCards,
    openApplicationsLastWeek: null,
    budgetRemainingMinor: Math.max(0, limits - spent),
    budgetRemainingLastMonthMinor: null,
    currency: budgetRows[0]?.currency ?? null,
  });

  return { values, weekStart: dayKey(thisWeek) };
}

/** Kept for callers that only need the definition text (the page's tooltips). */
export { KPI_DEFINITIONS } from "./kpis";
export type { KpiValue } from "./kpis";
