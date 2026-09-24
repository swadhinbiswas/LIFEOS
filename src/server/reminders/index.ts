import { and, desc, eq, isNull, lte } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { boards, cards, reminders } from "@/server/db/schema";

/**
 * Reminders (spec §6.9 / #28, ADR-054). One pending reminder per card; delivery is the
 * notification sweep, which reads `dueReminders` and marks each sent in the same pass. Nothing
 * here schedules a job — a reminder is a timestamp, not a worker.
 */

export type ReminderEntity = "card";
export type ReminderRow = typeof reminders.$inferSelect;

/** Replace any pending reminder for the entity with this one, so there is only ever one. */
export async function setReminder(
  userId: string,
  input: { entityType: ReminderEntity; entityId: string; fireAt: Date },
): Promise<ReminderRow> {
  // Ownership check: a reminder must never point at another user's card (the sweep would leak it).
  const [card] = await db
    .select({ id: cards.id })
    .from(cards)
    .where(and(eq(cards.id, input.entityId), eq(cards.user_id, userId), isNull(cards.deleted_at)))
    .limit(1);
  if (!card) throw new Error("card not found");

  await db
    .delete(reminders)
    .where(
      and(
        eq(reminders.user_id, userId),
        eq(reminders.entity_type, input.entityType),
        eq(reminders.entity_id, input.entityId),
        isNull(reminders.sent_at),
      ),
    );

  const [row] = await db
    .insert(reminders)
    .values({
      id: newId(),
      user_id: userId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      fire_at: input.fireAt,
    })
    .returning();
  if (!row) throw new Error("reminder insert returned no row");
  return row;
}

export async function getReminder(
  userId: string,
  entityType: ReminderEntity,
  entityId: string,
): Promise<ReminderRow | null> {
  const [row] = await db
    .select()
    .from(reminders)
    .where(
      and(
        eq(reminders.user_id, userId),
        eq(reminders.entity_type, entityType),
        eq(reminders.entity_id, entityId),
        isNull(reminders.sent_at),
      ),
    )
    .orderBy(desc(reminders.fire_at))
    .limit(1);
  return row ?? null;
}

export async function clearReminder(
  userId: string,
  entityType: ReminderEntity,
  entityId: string,
): Promise<void> {
  await db
    .delete(reminders)
    .where(
      and(
        eq(reminders.user_id, userId),
        eq(reminders.entity_type, entityType),
        eq(reminders.entity_id, entityId),
        isNull(reminders.sent_at),
      ),
    );
}

export interface DueReminder {
  id: string;
  entityId: string;
  title: string;
  href: string;
}

/** Due, unsent card reminders with the card's title and where to open it (for the sweep). */
export async function dueReminders(userId: string, now: Date = new Date()): Promise<DueReminder[]> {
  const rows = await db
    .select({
      id: reminders.id,
      entityId: reminders.entity_id,
      title: cards.title,
      boardId: cards.board_id,
      isSystem: boards.is_system,
    })
    .from(reminders)
    .innerJoin(cards, and(eq(cards.id, reminders.entity_id), eq(cards.user_id, userId)))
    .innerJoin(boards, eq(boards.id, cards.board_id))
    .where(
      and(
        eq(reminders.user_id, userId),
        eq(reminders.entity_type, "card"),
        isNull(reminders.sent_at),
        lte(reminders.fire_at, now),
        isNull(cards.deleted_at),
        isNull(boards.deleted_at),
      ),
    );

  return rows.map((row) => ({
    id: row.id,
    entityId: row.entityId,
    title: row.title,
    href: row.isSystem
      ? `/tasks?card=${row.entityId}`
      : `/boards/${row.boardId}?card=${row.entityId}`,
  }));
}

export async function markReminderSent(
  userId: string,
  id: string,
  now: Date = new Date(),
): Promise<void> {
  await db
    .update(reminders)
    .set({ sent_at: now })
    .where(and(eq(reminders.id, id), eq(reminders.user_id, userId), isNull(reminders.sent_at)));
}
