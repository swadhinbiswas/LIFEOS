import { and, asc, eq } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { attachments, cards } from "@/server/db/schema";

import { BoardError } from "./errors";
import { deleteAttachmentBytes } from "@/server/storage/attachments";

/**
 * Card attachments (spec §6.1 "attachments"). Two kinds:
 *
 * - `link`: a URL plus an optional display name (shipped in ADR-138).
 * - `file`: bytes on disk under `ATTACHMENTS_DIR` (ADR-140). The `storage_key` column holds the
 *   relative path; `url` is null. Files are capped at 10 MiB and served through an authenticated
 *   route, never a public URL.
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

export async function addFileAttachment(
  userId: string,
  cardId: string,
  input: { name: string; size: number; storageKey: string },
): Promise<CardAttachment> {
  await requireCard(userId, cardId);
  const [row] = await db
    .insert(attachments)
    .values({
      id: newId(),
      card_id: cardId,
      user_id: userId,
      kind: "file",
      url: null,
      storage_key: input.storageKey,
      name: input.name,
      size: input.size,
    })
    .returning();
  if (!row) throw new BoardError("not_found", "attachment insert returned no row");
  return row;
}

export async function removeAttachment(
  userId: string,
  attachmentId: string,
): Promise<CardAttachment[]> {
  const [row] = await db
    .select({
      cardId: attachments.card_id,
      kind: attachments.kind,
      storageKey: attachments.storage_key,
    })
    .from(attachments)
    .where(and(eq(attachments.id, attachmentId), eq(attachments.user_id, userId)))
    .limit(1);
  if (!row) throw new BoardError("not_found", "attachment not found");
  await db
    .delete(attachments)
    .where(and(eq(attachments.id, attachmentId), eq(attachments.user_id, userId)));
  if (row.kind === "file" && row.storageKey) {
    await deleteAttachmentBytes(row.storageKey).catch(() => undefined);
  }
  return listAttachments(userId, row.cardId);
}
