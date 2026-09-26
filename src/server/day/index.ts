import { and, eq, gte, lt, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { health_logs, transactions } from "@/server/db/schema";
import { logHealth, type HealthKind } from "@/server/health";
import { listHabits } from "@/server/habits";
import { habitConsistencyDetails } from "@/server/dashboard/habits";
import { focusDailySeries } from "@/server/focus";
import { getUserDayKey, getTimeZone } from "@/server/settings";
import { startOfDayInTimeZone } from "@/lib/timezone";

/**
 * One day, read across every domain that has an opinion about it (ADR-132).
 *
 * Every signal here was already stored and already had a page. What did not exist was the row. So
 * the question "was today bad because I slept five hours or because I was on the laptop?" had no
 * answer that did not involve opening four routes and doing arithmetic in your head — and a person
 * who cannot answer it does not change anything, they just conclude the tracking is not working.
 *
 * **A read model, not a new source of truth.** It composes the services that own each table and
 * stores nothing. Every number here is the same number the owning page shows, which is the property
 * that keeps it from becoming a fifth thing that can disagree with the other four.
 *
 * **`null` means "not recorded", never zero.** A day with no sleep entry has *unknown* sleep, and
 * rendering that as 0h — or worse, omitting it so a real 0h looks the same — is the failure this
 * type exists to prevent. `0` is a real answer for habits (the day came and went, nothing was
 * checked off) and for spend.
 */
export interface DaySignals {
  /** The user's local day key, `YYYY-MM-DD` (ADR-045). */
  day: string;
  /** Hours, as the user logged them. The module never converts; see the health service. */
  sleepHours: number | null;
  /** 1–5 as logged. No scale is invented and no mood is inferred from anything else. */
  mood: number | null;
  /** Percent of habits checked off, 0–100. `0` is a real answer. */
  habitPct: number;
  habitDone: number;
  habitTotal: number;
  focusMinutes: number;
  /** Minor units, as stored. Negative is an expense, so spend is the negated sum. */
  spentMinor: number;
  currency: string | null;
  /** How many of the five signals above were actually recorded. Drives the strip's own state. */
  recorded: number;
}

const TRACKED: number = 5;

/** Read every signal for one day. `day` defaults to the user's today. */
export async function readDaySignals(userId: string, day?: string): Promise<DaySignals> {
  const date = day ?? (await getUserDayKey(userId));
  const timeZone = await getTimeZone(userId);

  const [health, habits, focus, money] = await Promise.all([
    readHealth(userId, date),
    readHabits(userId, date),
    focusDailySeries(userId, 2, new Date(), timeZone).then((series) => {
      const row = series.find((entry) => entry.day === date);
      return row?.minutes ?? 0;
    }),
    readSpend(userId, date, timeZone),
  ]);

  const recorded = [
    health.sleepHours !== null,
    health.mood !== null,
    habits.habitTotal > 0,
    focus > 0,
    money.spentMinor > 0,
  ].filter(Boolean).length;

  return {
    day: date,
    sleepHours: health.sleepHours,
    mood: health.mood,
    habitPct: habits.habitPct,
    habitDone: habits.habitDone,
    habitTotal: habits.habitTotal,
    focusMinutes: focus,
    spentMinor: money.spentMinor,
    currency: money.currency,
    recorded,
  };
}

/**
 * A run of days, oldest first, for the review's correlation.
 *
 * `null` stays `null` across a run rather than being filled forward. Averages that skip missing
 * days are honest; a seven-day sleep average built from three recorded nights is a number about
 * three nights wearing a seven-day label.
 */
export async function readDaySignalsRange(userId: string, days = 7): Promise<DaySignals[]> {
  const timeZone = await getTimeZone(userId);
  const today = await getUserDayKey(userId);
  const window = Math.max(1, Math.min(90, Math.round(days)));

  // One read per domain for the whole run, not one per day. Seven days of four queries each is 28
  // round trips to build a single review paragraph.
  const [health, habits, focus] = await Promise.all([
    readHealthRange(userId, today, window),
    readHabitRange(userId),
    focusDailySeries(userId, window, new Date(), timeZone),
  ]);

  const focusByDay = new Map(focus.map((row) => [row.day, row.minutes]));

  return Array.from({ length: window }, (_, offset) => {
    // Count back from today rather than reading the keys off the focus series. The series is a
    // perfectly good source of day keys *when it has rows*, and on a day with no focus at all it
    // has none - so a key derived from it collapses the whole run onto today and every day in the
    // review claims to be the same day. Counting back is right either way.
    const day = shiftDay(today, -(window - 1) + offset);
    const sleepHours = health.get(day)?.sleep ?? null;
    const mood = health.get(day)?.mood ?? null;
    const habit = habits.get(day);
    const focusMinutes = focusByDay.get(day) ?? 0;
    return {
      day,
      sleepHours,
      mood,
      habitPct: habit?.pct ?? 0,
      habitDone: habit?.done ?? 0,
      habitTotal: habit?.total ?? 0,
      focusMinutes,
      spentMinor: 0,
      currency: null,
      recorded: [
        sleepHours !== null,
        mood !== null,
        (habit?.total ?? 0) > 0,
        focusMinutes > 0,
      ].filter(Boolean).length,
    } satisfies DaySignals;
  });
}

/** One tap on the dashboard, for the two signals people will actually record daily. */
export async function logDaySignal(
  userId: string,
  input: { kind: "sleep" | "mood"; value: number; day?: string },
): Promise<DaySignals> {
  await logHealth(userId, {
    kind: input.kind as HealthKind,
    value: input.value,
    ...(input.day ? { date: input.day } : {}),
  });
  return readDaySignals(userId, input.day);
}

async function readHealth(
  userId: string,
  day: string,
): Promise<{ sleepHours: number | null; mood: number | null }> {
  const rows = await db
    .select({ kind: health_logs.kind, value: health_logs.value })
    .from(health_logs)
    .where(
      and(
        eq(health_logs.user_id, userId),
        eq(health_logs.date, day),
        sql`${health_logs.kind} in ('sleep','mood')`,
      ),
    );
  const byKind = new Map(rows.map((row) => [row.kind, row.value]));
  return { sleepHours: byKind.get("sleep") ?? null, mood: byKind.get("mood") ?? null };
}

/** A whole run of health rows in one query, keyed by day. */
async function readHealthRange(
  userId: string,
  today: string,
  window: number,
): Promise<Map<string, { sleep: number | null; mood: number | null }>> {
  const first = shiftDay(today, -(window - 1));
  const rows = await db
    .select({ kind: health_logs.kind, value: health_logs.value, date: health_logs.date })
    .from(health_logs)
    .where(
      and(
        eq(health_logs.user_id, userId),
        sql`${health_logs.kind} in ('sleep','mood')`,
        sql`${health_logs.date} >= ${first}`,
      ),
    );
  const byDay = new Map<string, { sleep: number | null; mood: number | null }>();
  for (const row of rows) {
    const entry = byDay.get(row.date) ?? { sleep: null, mood: null };
    if (row.kind === "sleep") entry.sleep = row.value;
    if (row.kind === "mood") entry.mood = row.value;
    byDay.set(row.date, entry);
  }
  return byDay;
}

async function readHabits(
  userId: string,
  day: string,
): Promise<{ habitPct: number; habitDone: number; habitTotal: number }> {
  const habits = await listHabits(userId, day);
  const details = habitConsistencyDetails(
    habits.map((row) => ({
      id: row.habit.id,
      name: row.habit.name,
      streak: row.streak,
      days: row.days,
    })),
    1,
  );
  const row = details.find((entry) => entry.day === day) ?? details.at(-1);
  return {
    habitPct: row?.value ?? 0,
    habitDone: row?.done ?? 0,
    habitTotal: habits.length,
  };
}

/** Habit completion for the whole run, one query, keyed by day. */
async function readHabitRange(
  userId: string,
): Promise<Map<string, { pct: number; done: number; total: number }>> {
  const habits = await listHabits(userId);
  if (habits.length === 0) return new Map();
  const details = habitConsistencyDetails(
    habits.map((row) => ({
      id: row.habit.id,
      name: row.habit.name,
      streak: row.streak,
      days: row.days,
    })),
    30,
  );
  const byDay = new Map<string, { pct: number; done: number; total: number }>();
  for (const row of details) {
    byDay.set(row.day, { pct: row.value, done: row.done, total: habits.length });
  }
  return byDay;
}

async function readSpend(
  userId: string,
  day: string,
  timeZone: string,
): Promise<{ spentMinor: number; currency: string | null }> {
  const from = startOfDayInTimeZone(day, timeZone);
  const rows = await db
    .select({ amountMinor: transactions.amount_minor, currency: transactions.currency })
    .from(transactions)
    .where(
      and(
        eq(transactions.user_id, userId),
        gte(transactions.occurred_at, from),
        lt(transactions.occurred_at, new Date(from.getTime() + 24 * 60 * 60 * 1000)),
      ),
    );
  if (rows.length === 0) return { spentMinor: 0, currency: null };
  // Only expenses count as spending, and only within one currency. A sum across currencies would be
  // an arithmetic result with no meaning, so the first currency wins and the rest is a separate
  // question this row cannot answer.
  const currency = rows[0]!.currency;
  const spent = rows
    .filter((row) => row.currency === currency)
    .reduce((total, row) => total + row.amountMinor, 0);
  return { spentMinor: -spent, currency };
}

function shiftDay(day: string, by: number): string {
  const at = new Date(`${day}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + by);
  return at.toISOString().slice(0, 10);
}

export { TRACKED as DAY_SIGNAL_COUNT };
