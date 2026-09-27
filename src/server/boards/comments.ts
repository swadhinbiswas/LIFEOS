import { and, asc, eq } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { cards, comments } from "@/server/db/schema";

import { BoardError } from "./errors";

/**
 * Card comments (spec §6.1 "comments/activity log").
 *
 * The table carries an `actor` label so the same thread can hold a person's note and an agent's
 * entry; today every row is `user`, and the UI only names the actor when it *isn't* the person
 * reading, so a future `ai` entry is visible without a schema change.
 *
 * Bodies are stored as written and rendered **as text**, never as HTML. The app has no Markdown
 * renderer by design (spec §10: sanitize or don't render), so a comment is displayed with its
 * whitespace preserved — which is honest about what it is rather than half-rendering it.
 *
 * Ordering is `created_at` ascending, the order a conversation is read; the index is
 * `(card_id, created_at)`, so the read is one scan and needs no sort.
 */

export type CardComment = typeof comments.$inferSelect;

async function requireCard(userId: string, cardId: string): Promise<void> {
  const [card] = await db
    .select({ id: cards.id })
    .from(cards)
    .where(and(eq(cards.id, cardId), eq(cards.user_id, userId)))
    .limit(1);
  if (!card) throw new BoardError("not_found", "card not found");
}

export async function listComments(userId: string, cardId: string): Promise<CardComment[]> {
  await requireCard(userId, cardId);
  return db
    .select()
    .from(comments)
    .where(and(eq(comments.card_id, cardId), eq(comments.user_id, userId)))
    .orderBy(asc(comments.created_at));
}

export async function addComment(
  userId: string,
  cardId: string,
  body: string,
): Promise<CardComment[]> {
  await requireCard(userId, cardId);
  await db.insert(comments).values({
    id: newId(),
    card_id: cardId,
    user_id: userId,
    body,
    actor: "user",
  });
  return listComments(userId, cardId);
}

export async function removeComment(userId: string, commentId: string): Promise<CardComment[]> {
  const [row] = await db
    .delete(comments)
    .where(and(eq(comments.id, commentId), eq(comments.user_id, userId)))
    .returning({ cardId: comments.card_id });
  if (!row) throw new BoardError("not_found", "comment not found");
  return listComments(userId, row.cardId);
}
