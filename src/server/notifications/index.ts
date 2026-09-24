import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";

import { newId } from "@/lib/id";
import {
  DEFAULT_TIME_ZONE,
  dayKeyInTimeZone,
  endOfDayInTimeZone,
  startOfDayInTimeZone,
} from "@/lib/timezone";
import { getFollowUpsDue } from "@/server/career/analytics";
import { db } from "@/server/db";
import { boards, cards, notifications } from "@/server/db/schema";
import { listSubscriptions } from "@/server/finance";
import { formatMinor } from "@/server/finance/money";
import { listHabits } from "@/server/habits";
import { shiftDay } from "@/server/habits/streak";
import { dueReminders, markReminderSent } from "@/server/reminders";

import { weekKey } from "./windows";

/**
 * Notification centre (spec §6.9, ADR-047). Rows are **generated on read**: every call sweeps
 * the sources and inserts only what is new — deduped by a per-source key — then returns the
 * list. There is no worker and no summary table, and because the sweep is idempotent it is safe
 * to run on every page (the header bell does exactly that).
 *
 * Sources today: due/overdue tasks, habits missed yesterday, and job follow-ups that have gone
 * quiet. Email/web-push channels and quiet hours are Phase 7 / MVP #61, not stubbed here.
 */

export type NotificationKind = "task" | "habit" | "job" | "billing" | "system";

export interface NotificationView {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  /** ISO instant, or null while unread. */
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPage {
  items: NotificationView[];
  unread: number;
}

/** A nudge the sweep wants to exist; `dedupeKey` is what makes re-running it a no-op. */
interface Draft {
  kind: NotificationKind;
  title: string;
  body?: string;
  href?: string;
  dedupeKey: string;
}

const toView = (row: typeof notifications.$inferSelect): NotificationView => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  body: row.body,
  href: row.href,
  readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
  createdAt: new Date(row.created_at).toISOString(),
});

/**
 * One aggregate nudge a day for the tasks board, so a long backlog is a count rather than a
 * wall of rows. Scoped to the system Tasks board (job and project cards can carry due dates too
 * and must not double-count here). The count is a snapshot; the link lands on the live board.
 */
async function taskDrafts(userId: string, now: Date, timeZone: string): Promise<Draft[]> {
  const day = dayKeyInTimeZone(now, timeZone);
  const dayStart = startOfDayInTimeZone(day, timeZone);
  const dayEnd = endOfDayInTimeZone(day, timeZone);
  const rows = await db
    .select({ dueAt: cards.due_at })
    .from(cards)
    .innerJoin(boards, eq(cards.board_id, boards.id))
    .where(
      and(
        eq(cards.user_id, userId),
        eq(boards.is_system, true),
        isNull(boards.deleted_at),
        isNull(cards.deleted_at),
        isNull(cards.archived_at),
        isNull(cards.completed_at),
        lt(cards.due_at, dayEnd), // NULL < x is NULL, so undated cards are excluded
      ),
    );

  let overdue = 0;
  let dueToday = 0;
  for (const row of rows) {
    if (row.dueAt && new Date(row.dueAt).getTime() < dayStart.getTime()) overdue += 1;
    else dueToday += 1;
  }
  if (overdue + dueToday === 0) return [];

  const tasks = (count: number) => `task${count === 1 ? "" : "s"}`;
  const title =
    overdue > 0 && dueToday > 0
      ? `${overdue} ${tasks(overdue)} overdue, ${dueToday} due today`
      : overdue > 0
        ? `${overdue} ${tasks(overdue)} overdue`
        : `${dueToday} ${tasks(dueToday)} due today`;

  return [
    {
      kind: "task",
      title,
      body: "open the tasks board to clear them",
      href: "/tasks",
      dedupeKey: `task:${day}`,
    },
  ];
}

/**
 * A habit that was skipped yesterday while it was still active, and is still open today — the
 * "never miss twice" nudge. Per habit, so each one links somewhere the user can act on it.
 */
async function habitDrafts(userId: string, now: Date, timeZone: string): Promise<Draft[]> {
  const today = dayKeyInTimeZone(now, timeZone);
  const yesterday = shiftDay(today, -1);
  const activeFrom = shiftDay(today, -14);
  const views = await listHabits(userId, today);

  const drafts: Draft[] = [];
  for (const view of views) {
    if (view.value > 0) continue; // already done today — nothing to nudge
    const missed = view.days.find((day) => day.key === yesterday);
    if (!missed || missed.done) continue; // done yesterday, or no history at all
    const active = view.days.some(
      (day) => day.done && day.key >= activeFrom && day.key <= yesterday,
    );
    if (!active) continue; // a dormant habit is not a missed streak
    drafts.push({
      kind: "habit",
      title: `missed yesterday: ${view.habit.name}`,
      body: "never miss twice — log it today",
      href: "/habits",
      dedupeKey: `habit:${view.habit.id}:${today}`,
    });
  }
  return drafts;
}

/** One follow-up nudge a week per quiet application, using the career module's stale rule. */
async function jobDrafts(userId: string, now: Date): Promise<Draft[]> {
  const due = await getFollowUpsDue(userId, now, 7);
  const key = weekKey(now);
  return due.map((row) => ({
    kind: "job",
    title: `follow up: ${row.title}`,
    body: `${row.stage} · no movement for ${row.days} day${row.days === 1 ? "" : "s"}`,
    href: "/career/jobs",
    dedupeKey: `job:${row.cardId}:${key}`,
  }));
}

/**
 * A renewal nudge for a subscription due within three days (or overdue by up to a week), once a
 * week per subscription (ADR-050). The `billing` kind already exists in the schema for this.
 */
async function subscriptionDrafts(userId: string, now: Date, timeZone: string): Promise<Draft[]> {
  const subscriptions = await listSubscriptions(userId, now, timeZone);
  const key = weekKey(now);
  return subscriptions
    .filter(({ dueInDays }) => dueInDays !== null && dueInDays <= 3 && dueInDays >= -7)
    .map(({ subscription, dueInDays }) => ({
      kind: "billing" as const,
      title:
        dueInDays !== null && dueInDays > 0
          ? `renews in ${dueInDays} day${dueInDays === 1 ? "" : "s"}: ${subscription.name}`
          : dueInDays === 0
            ? `renews today: ${subscription.name}`
            : `renewal overdue: ${subscription.name}`,
      body: `${formatMinor(subscription.amount_minor, subscription.currency)} / ${subscription.cadence}`,
      href: "/finance",
      dedupeKey: `subscription:${subscription.id}:${key}`,
    }));
}

/**
 * A due card reminder becomes a notification once, keyed by the reminder row itself, and is marked
 * sent in the same pass (ADR-054) — so the sweep stays idempotent and no worker is needed.
 */
async function reminderDrafts(userId: string, now: Date): Promise<Draft[]> {
  const due = await dueReminders(userId, now);
  const drafts = due.map((reminder) => ({
    kind: "task" as const,
    title: `reminder: ${reminder.title}`,
    body: "you asked to be reminded",
    href: reminder.href,
    dedupeKey: `reminder:${reminder.id}`,
  }));
  for (const reminder of due) await markReminderSent(userId, reminder.id, now);
  return drafts;
}

/**
 * Evaluate every source and insert the drafts that are not already present. Returns how many
 * rows the sweep actually created (0 on a repeat), which is what the tests assert on.
 */
export async function sweepNotifications(
  userId: string,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): Promise<number> {
  const drafts = [
    ...(await taskDrafts(userId, now, timeZone)),
    ...(await habitDrafts(userId, now, timeZone)),
    ...(await jobDrafts(userId, now)),
    ...(await subscriptionDrafts(userId, now, timeZone)),
    ...(await reminderDrafts(userId, now)),
  ];
  if (drafts.length === 0) return 0;

  const inserted = await db
    .insert(notifications)
    .values(
      drafts.map((draft) => ({
        id: newId(),
        user_id: userId,
        kind: draft.kind,
        title: draft.title,
        body: draft.body ?? null,
        href: draft.href ?? null,
        dedupe_key: draft.dedupeKey,
      })),
    )
    .onConflictDoNothing({ target: [notifications.user_id, notifications.dedupe_key] })
    .returning({ id: notifications.id });

  return inserted.length;
}

async function countUnread(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.user_id, userId), isNull(notifications.read_at)));
  return Number(row?.value ?? 0);
}

/** The bell's number: sweep first so a nudge that just became true is counted immediately. */
export async function unreadCount(
  userId: string,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): Promise<number> {
  await sweepNotifications(userId, now, timeZone);
  return countUnread(userId);
}

/** The centre's data: newest first, with the unread total across all rows (not just this page). */
export async function listNotifications(
  userId: string,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
  limit = 100,
): Promise<NotificationPage> {
  await sweepNotifications(userId, now, timeZone);

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.user_id, userId))
    .orderBy(desc(notifications.created_at))
    .limit(limit);

  return { items: rows.map(toView), unread: await countUnread(userId) };
}

/** Mark one notification read. Scoped to the user, and a no-op if it is already read. */
export async function markNotificationRead(
  userId: string,
  id: string,
  now: Date = new Date(),
): Promise<void> {
  await db
    .update(notifications)
    .set({ read_at: now, updated_at: now })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.user_id, userId),
        isNull(notifications.read_at),
      ),
    );
}

export async function markAllNotificationsRead(
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  await db
    .update(notifications)
    .set({ read_at: now, updated_at: now })
    .where(and(eq(notifications.user_id, userId), isNull(notifications.read_at)));
}
