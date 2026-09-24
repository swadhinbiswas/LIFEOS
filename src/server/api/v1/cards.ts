import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { boards, cards } from "@/server/db/schema";
import {
  createCard,
  deleteCard,
  ensureSystemTasksBoard,
  getBoard,
  updateCard,
} from "@/server/boards";

/**
 * The card resource the REST layer exposes (spec §9.1). These are thin adapters over the board
 * service — the same writer the UI uses — plus a keyset listing and a stable JSON shape.
 */

export interface ApiCard {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description: string | null;
  priority: string | null;
  due_at: string | null;
  start_at: string | null;
  estimate_min: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

export const serializeCard = (card: typeof cards.$inferSelect): ApiCard => ({
  id: card.id,
  board_id: card.board_id,
  column_id: card.column_id,
  title: card.title,
  description: card.description,
  priority: card.priority,
  due_at: card.due_at ? new Date(card.due_at).toISOString() : null,
  start_at: card.start_at ? new Date(card.start_at).toISOString() : null,
  estimate_min: card.estimate_min,
  completed_at: card.completed_at ? new Date(card.completed_at).toISOString() : null,
  created_at: new Date(card.created_at).toISOString(),
  updated_at: new Date(card.updated_at).toISOString(),
  version: card.version,
});

export interface KeysetCursorLike {
  createdAt: string;
  id: string;
}

export async function listCards(
  userId: string,
  options: {
    limit: number;
    cursor: KeysetCursorLike | null;
    boardId: string | null;
    q: string | null;
  },
): Promise<{ items: ApiCard[]; nextCursor: KeysetCursorLike | null }> {
  const filters = [eq(cards.user_id, userId), isNull(cards.deleted_at), isNull(boards.deleted_at)];
  if (options.boardId) filters.push(eq(cards.board_id, options.boardId));
  if (options.q) {
    filters.push(sql`lower(${cards.title}) like ${`%${options.q.toLowerCase()}%`}`);
  }
  if (options.cursor) {
    const at = new Date(options.cursor.createdAt);
    const keyset = or(
      lt(cards.created_at, at),
      and(eq(cards.created_at, at), lt(cards.id, options.cursor.id)),
    );
    if (keyset) filters.push(keyset);
  }

  const rows = await db
    .select({ card: cards })
    .from(cards)
    .innerJoin(boards, eq(cards.board_id, boards.id))
    .where(and(...filters))
    .orderBy(desc(cards.created_at), desc(cards.id))
    .limit(options.limit + 1);

  const page = rows.slice(0, options.limit).map((row) => row.card);
  const last = page.at(-1);
  const nextCursor =
    rows.length > options.limit && last
      ? { createdAt: new Date(last.created_at).toISOString(), id: last.id }
      : null;
  return { items: page.map(serializeCard), nextCursor };
}

export async function createTask(
  userId: string,
  input: {
    title: string;
    boardId?: string | null;
    columnId?: string | null;
    dueAt?: Date | null;
    priority?: "p0" | "p1" | "p2" | "p3" | null;
  },
): Promise<ApiCard> {
  const boardId = input.boardId ?? (await ensureSystemTasksBoard(userId)).id;
  let columnId = input.columnId ?? null;
  if (!columnId) {
    const payload = await getBoard(userId, boardId);
    const inbox = payload.columns.find((column) => column.name === "Inbox") ?? payload.columns[0];
    if (!inbox) throw new Error("board has no columns");
    columnId = inbox.id;
  }

  const card = await createCard(userId, {
    boardId,
    columnId,
    title: input.title,
    dueAt: input.dueAt ?? null,
    priority: input.priority ?? null,
  });
  return serializeCard(card);
}

/** Resolve one card the user owns; null for a card that is missing, deleted or not theirs. */
export async function getCard(userId: string, cardId: string): Promise<ApiCard | null> {
  const [row] = await db
    .select()
    .from(cards)
    .where(and(eq(cards.id, cardId), eq(cards.user_id, userId), isNull(cards.deleted_at)))
    .limit(1);
  return row ? serializeCard(row) : null;
}

export async function updateCardViaApi(
  userId: string,
  cardId: string,
  input: {
    title?: string;
    description?: string | null;
    priority?: "p0" | "p1" | "p2" | "p3" | null;
    dueAt?: Date | null;
    startAt?: Date | null;
    estimateMin?: number | null;
  },
): Promise<ApiCard | null> {
  const current = await getCard(userId, cardId);
  if (!current) return null;
  const card = await updateCard(userId, { cardId, version: current.version, ...input });
  return serializeCard(card);
}

export async function deleteCardViaApi(userId: string, cardId: string): Promise<boolean> {
  const current = await getCard(userId, cardId);
  if (!current) return false;
  await deleteCard(userId, cardId);
  return true;
}

export const cardEtag = (card: ApiCard): string => `"v${card.version}"`;
