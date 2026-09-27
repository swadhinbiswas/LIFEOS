import { and, asc, desc, eq, sql } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { cards, checklist_items, checklists } from "@/server/db/schema";

import { BoardError } from "./errors";

/**
 * Card checklists / subtasks (spec §6.1 "checklist/subtasks with progress meter").
 *
 * A card has one implicit checklist, created on the first item: the spec's card anatomy asks for
 * "a checklist with progress", not for several named lists, and an empty checklist created on
 * demand would be a row nobody asked for. The tables allow many per card, so named lists are a UI
 * decision left open rather than a schema change.
 *
 * The `checklistProgress` aggregate is what the card face renders, so it is computed in one grouped
 * query for the whole board rather than per card — a board of 500 cards with a checklist each would
 * otherwise be 500 round trips to draw a progress bar.
 *
 * Every function takes `userId` first and filters by it (ADR-026): an item is reachable only through
 * a card the caller owns.
 */

export type ChecklistItem = typeof checklist_items.$inferSelect;

export interface ChecklistProgress {
  done: number;
  total: number;
}

export interface CardChecklist {
  items: ChecklistItem[];
  progress: ChecklistProgress;
}

async function requireCard(userId: string, cardId: string): Promise<void> {
  const [card] = await db
    .select({ id: cards.id })
    .from(cards)
    .where(and(eq(cards.id, cardId), eq(cards.user_id, userId)))
    .limit(1);
  if (!card) throw new BoardError("not_found", "card not found");
}

/** The card's checklist row, created on first use. */
async function checklistFor(userId: string, cardId: string): Promise<string> {
  const [existing] = await db
    .select({ id: checklists.id })
    .from(checklists)
    .where(and(eq(checklists.card_id, cardId), eq(checklists.user_id, userId)))
    .orderBy(asc(checklists.position))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(checklists)
    .values({
      id: newId(),
      card_id: cardId,
      user_id: userId,
      title: "checklist",
      position: generateKeyBetween(null, null),
    })
    .returning({ id: checklists.id });
  if (!created) throw new BoardError("invalid", "could not create the checklist");
  return created.id;
}

export async function listCardChecklist(userId: string, cardId: string): Promise<CardChecklist> {
  await requireCard(userId, cardId);
  const items = await db
    .select({ item: checklist_items })
    .from(checklist_items)
    .innerJoin(checklists, eq(checklists.id, checklist_items.checklist_id))
    .where(and(eq(checklists.card_id, cardId), eq(checklists.user_id, userId)))
    .orderBy(asc(checklist_items.position))
    .then((rows) => rows.map((row) => row.item));

  return {
    items,
    progress: { done: items.filter((item) => item.done_at !== null).length, total: items.length },
  };
}

export async function addChecklistItem(
  userId: string,
  cardId: string,
  text: string,
): Promise<CardChecklist> {
  await requireCard(userId, cardId);
  const checklistId = await checklistFor(userId, cardId);
  const [last] = await db
    .select({ position: checklist_items.position })
    .from(checklist_items)
    .where(eq(checklist_items.checklist_id, checklistId))
    .orderBy(desc(checklist_items.position))
    .limit(1);

  await db.insert(checklist_items).values({
    id: newId(),
    checklist_id: checklistId,
    user_id: userId,
    text,
    position: generateKeyBetween(last?.position ?? null, null),
  });
  return listCardChecklist(userId, cardId);
}

/** The item's card, after proving the caller owns the item. */
async function cardForItem(userId: string, itemId: string): Promise<string> {
  const [row] = await db
    .select({ cardId: checklists.card_id })
    .from(checklist_items)
    .innerJoin(checklists, eq(checklists.id, checklist_items.checklist_id))
    .where(and(eq(checklist_items.id, itemId), eq(checklist_items.user_id, userId)))
    .limit(1);
  if (!row) throw new BoardError("not_found", "checklist item not found");
  return row.cardId;
}

export async function setChecklistItemDone(
  userId: string,
  itemId: string,
  done: boolean,
): Promise<CardChecklist> {
  const cardId = await cardForItem(userId, itemId);
  await db
    .update(checklist_items)
    .set({ done_at: done ? new Date() : null, updated_at: new Date() })
    .where(and(eq(checklist_items.id, itemId), eq(checklist_items.user_id, userId)));
  return listCardChecklist(userId, cardId);
}

export async function setChecklistItemText(
  userId: string,
  itemId: string,
  text: string,
): Promise<CardChecklist> {
  const cardId = await cardForItem(userId, itemId);
  await db
    .update(checklist_items)
    .set({ text, updated_at: new Date() })
    .where(and(eq(checklist_items.id, itemId), eq(checklist_items.user_id, userId)));
  return listCardChecklist(userId, cardId);
}

export async function removeChecklistItem(userId: string, itemId: string): Promise<CardChecklist> {
  const cardId = await cardForItem(userId, itemId);
  await db
    .delete(checklist_items)
    .where(and(eq(checklist_items.id, itemId), eq(checklist_items.user_id, userId)));
  return listCardChecklist(userId, cardId);
}

/**
 * Progress per card for one board, in one query. Cards with no checklist items are absent rather
 * than zeroed, so the card face draws nothing instead of `▱▱▱▱▱▱ 0%` on every ordinary card.
 */
export async function checklistProgressForBoard(
  userId: string,
  boardId: string,
): Promise<Record<string, ChecklistProgress>> {
  const rows = await db
    .select({
      cardId: checklists.card_id,
      total: sql<number>`count(*)`,
      done: sql<number>`coalesce(sum(case when ${checklist_items.done_at} is null then 0 else 1 end), 0)`,
    })
    .from(checklist_items)
    .innerJoin(checklists, eq(checklists.id, checklist_items.checklist_id))
    .innerJoin(cards, eq(cards.id, checklists.card_id))
    .where(
      and(eq(cards.board_id, boardId), eq(cards.user_id, userId), eq(checklists.user_id, userId)),
    )
    .groupBy(checklists.card_id);

  return Object.fromEntries(
    rows.map((row) => [row.cardId, { done: Number(row.done), total: Number(row.total) }]),
  );
}
