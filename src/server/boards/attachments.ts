import { and, asc, eq } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { attachments, cards } from "@/server/db/schema";

import { BoardError } from "./errors";

/**
 * Card attachments (spec §6.1 "attachments"). v1 is links only: a URL plus an optional display
 * name. File uploads need a storage backend decision (local volume vs. S3-compatible) that is
 * not settled for self-hosters, so bytes are out of scope here — the schema's `storage_key`
 * column is reserved for that later pass and stays null for links.
 *
 * A link is stored as written and rendered as an anchor with `rel="noopener noreferrer"`; the
 * app has no preview renderer, so a link is a link, not a half-embedded card.
 */

export type CardAttachment = typeof attachments.$inferSelect;

async function requireCard(userId: string, cardId: string): Promise<void> {
  const [card] = await db
    .select({ id: cards.id })
    .from(cards)
    .where(and(eq(cards.id, cardId), eq(cards.user_id, userId)))
    .limit(1);
  if (!card) throw new BoardError("not_found", "card not found");
}

export async function listAttachments(userId: string, cardId: string): Promise<CardAttachment[]> {
  await requireCard(userId, cardId);
  return db
    .select()
    .from(attachments)
    .where(and(eq(attachments.card_id, cardId), eq(attachments.user_id, userId)))
    .orderBy(asc(attachments.created_at));
}

export async function addAttachment(
  userId: string,
  cardId: string,
  input: { url: string; name?: string | null },
): Promise<CardAttachment[]> {
  await requireCard(userId, cardId);
  await db.insert(attachments).values({
    id: newId(),
    card_id: cardId,
    user_id: userId,
    kind: "link",
    url: input.url,
    name: input.name ?? null,
  });
  return listAttachments(userId, cardId);
}

export async function removeAttachment(
  userId: string,
  attachmentId: string,
): Promise<CardAttachment[]> {
  const [row] = await db
    .select({ cardId: attachments.card_id })
    .from(attachments)
    .where(and(eq(attachments.id, attachmentId), eq(attachments.user_id, userId)))
    .limit(1);
  if (!row) throw new BoardError("not_found", "attachment not found");
  await db
    .delete(attachments)
    .where(and(eq(attachments.id, attachmentId), eq(attachments.user_id, userId)));
  return listAttachments(userId, row.cardId);
}
