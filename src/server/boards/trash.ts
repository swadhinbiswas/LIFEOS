import { and, desc, eq, isNotNull, lt } from "drizzle-orm";

import { db } from "@/server/db";
import { cards } from "@/server/db/schema";

import type { Card } from "./index";

/**
 * Trash (spec §6.1: soft delete with a 30-day Trash). Deleted cards keep their fractional key
 * (the unique index only covers live rows), so a restore needs no rewrite; purging is the only
 * hard delete in the board domain and always narrows to the caller's own trashed rows.
 */

export async function listTrash(userId: string, boardId: string): Promise<Card[]> {
  return db
    .select()
    .from(cards)
    .where(and(eq(cards.user_id, userId), eq(cards.board_id, boardId), isNotNull(cards.deleted_at)))
    .orderBy(desc(cards.deleted_at));
}

/** Hard-delete trashed cards past the retention window. Returns how many rows went. */
export async function purgeTrash(
  userId: string,
  olderThanDays = 30,
  now: Date = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - olderThanDays * 24 * 60 * 60 * 1000);
  const removed = await db
    .delete(cards)
    .where(
      and(eq(cards.user_id, userId), isNotNull(cards.deleted_at), lt(cards.deleted_at, cutoff)),
    )
    .returning({ id: cards.id });
  return removed.length;
}

/** "Delete forever" for one card — only ever a card that is already trashed. */
export async function purgeCard(userId: string, cardId: string): Promise<void> {
  await db
    .delete(cards)
    .where(and(eq(cards.id, cardId), eq(cards.user_id, userId), isNotNull(cards.deleted_at)));
}
