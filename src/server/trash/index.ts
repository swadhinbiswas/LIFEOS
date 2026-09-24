import { and, eq, isNotNull } from "drizzle-orm";

import { restoreCard } from "@/server/boards";
import { purgeCard, purgeTrash } from "@/server/boards/trash";
import { db } from "@/server/db";
import { boards, cards } from "@/server/db/schema";
import { listTrashedNotes, purgeNote, purgeTrashedNotes, restoreNote } from "@/server/notes";

/**
 * Cross-module trash (spec §6.9, ADR-048): one view over the soft-deleted rows that cards and
 * notes already keep. Restore and purge are dispatched back to the owning service, so this module
 * owns no row and there is a single writer per table. Retention is one rule (30 days) applied
 * **on read**, so the trash cannot grow without a cron.
 */

export type TrashKind = "card" | "note";

export interface TrashItem {
  kind: TrashKind;
  id: string;
  title: string;
  /** ISO instant the row was deleted. */
  deletedAt: string;
  /** Board name for a card, note kind for a note — how the row is described in the list. */
  context: string | null;
}

export interface TrashPage {
  items: TrashItem[];
  /** Rows hard-deleted as expired during this read. */
  purged: number;
}

const RETENTION_DAYS = 30;

async function purgeExpired(userId: string, now: Date): Promise<number> {
  const trashedCards = await purgeTrash(userId, RETENTION_DAYS, now);
  const trashedNotes = await purgeTrashedNotes(userId, RETENTION_DAYS, now);
  return trashedCards + trashedNotes;
}

/** Everything the user has trashed, newest first, after dropping rows past retention. */
export async function listTrash(userId: string, now: Date = new Date()): Promise<TrashPage> {
  const purged = await purgeExpired(userId, now);

  const cardRows = await db
    .select({ id: cards.id, title: cards.title, deletedAt: cards.deleted_at, board: boards.name })
    .from(cards)
    .innerJoin(boards, eq(cards.board_id, boards.id))
    .where(and(eq(cards.user_id, userId), isNotNull(cards.deleted_at)));

  const noteRows = await listTrashedNotes(userId);

  const items: TrashItem[] = [
    ...cardRows.map((row) => ({
      kind: "card" as const,
      id: row.id,
      title: row.title,
      deletedAt: (row.deletedAt ?? new Date()).toISOString(),
      context: row.board,
    })),
    ...noteRows.map((row) => ({
      kind: "note" as const,
      id: row.id,
      title: row.title || "(untitled)",
      deletedAt: (row.deleted_at ?? new Date()).toISOString(),
      context: row.kind,
    })),
  ].sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1));

  return { items, purged };
}

export async function restoreItem(userId: string, kind: TrashKind, id: string): Promise<void> {
  if (kind === "card") await restoreCard(userId, id);
  else await restoreNote(userId, id);
}

export async function purgeItem(userId: string, kind: TrashKind, id: string): Promise<void> {
  if (kind === "card") await purgeCard(userId, id);
  else await purgeNote(userId, id);
}

/** The explicit purge button; the read path already runs the same rule (ADR-048). */
export async function purgeExpiredItems(userId: string, now: Date = new Date()): Promise<number> {
  return purgeExpired(userId, now);
}
