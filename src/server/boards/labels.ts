import { and, asc, eq, inArray } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { boards, card_labels, cards, labels } from "@/server/db/schema";

import { BoardError } from "./errors";

/**
 * Board labels (spec §6.1): a board-scoped colour + name, attached to cards.
 *
 * Labels are to a board what cross-module tags are to the whole app (ADR-059) — `card-tags.tsx`
 * groups a card with notes under a name, while a label is a board's own vocabulary and its colour
 * is what the board filters on. Both exist deliberately; the capture grammar's `#tag` creates a
 * label, which is why its naming rule is reused here: lowercased and trimmed, unique per board, so
 * `#Home` and `#home` are one label rather than two that look identical.
 *
 * The card's labels are replaced as a set (`setCardLabels`), not toggled one call at a time: the
 * editor holds the whole selection, and a set is idempotent — a double-click cannot produce a
 * duplicate or lose an add. `replace` marks every label as belonging to this board and user before
 * touching the join table, so an id from someone else's board is a 404, not a silent attachment.
 */

export type Label = typeof labels.$inferSelect;

/** The one naming rule, shared with the capture grammar (`attachLabels`). */
export const normalizeLabelName = (name: string): string => name.trim().toLowerCase();

async function requireBoard(userId: string, boardId: string): Promise<void> {
  const [board] = await db
    .select({ id: boards.id })
    .from(boards)
    .where(and(eq(boards.id, boardId), eq(boards.user_id, userId)))
    .limit(1);
  if (!board) throw new BoardError("not_found", "board not found");
}

async function requireCardBoardId(userId: string, cardId: string): Promise<string> {
  const [card] = await db
    .select({ boardId: cards.board_id })
    .from(cards)
    .where(and(eq(cards.id, cardId), eq(cards.user_id, userId)))
    .limit(1);
  if (!card) throw new BoardError("not_found", "card not found");
  return card.boardId;
}

export async function listBoardLabels(userId: string, boardId: string): Promise<Label[]> {
  await requireBoard(userId, boardId);
  return db
    .select()
    .from(labels)
    .where(and(eq(labels.board_id, boardId), eq(labels.user_id, userId)))
    .orderBy(asc(labels.name));
}

/** Create a label, or recolour the one that already has that name (idempotent by name). */
export async function createBoardLabel(
  userId: string,
  boardId: string,
  input: { name: string; color?: string | null },
): Promise<Label> {
  await requireBoard(userId, boardId);
  const name = normalizeLabelName(input.name);
  if (name === "") throw new BoardError("invalid", "a label needs a name");

  const [created] = await db
    .insert(labels)
    .values({
      id: newId(),
      board_id: boardId,
      user_id: userId,
      name,
      color: input.color ?? null,
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  const [existing] = await db
    .update(labels)
    .set({ color: input.color ?? null, updated_at: new Date() })
    .where(and(eq(labels.board_id, boardId), eq(labels.user_id, userId), eq(labels.name, name)))
    .returning();
  if (!existing) throw new BoardError("invalid", "could not create the label");
  return existing;
}

export async function deleteBoardLabel(userId: string, labelId: string): Promise<void> {
  const removed = await db
    .delete(labels)
    .where(and(eq(labels.id, labelId), eq(labels.user_id, userId)))
    .returning({ id: labels.id });
  if (removed.length === 0) throw new BoardError("not_found", "label not found");
}

export async function cardLabels(userId: string, cardId: string): Promise<Label[]> {
  return db
    .select({ label: labels })
    .from(card_labels)
    .innerJoin(labels, eq(labels.id, card_labels.label_id))
    .where(and(eq(card_labels.card_id, cardId), eq(card_labels.user_id, userId)))
    .orderBy(asc(labels.name))
    .then((rows) => rows.map((row) => row.label));
}

/** Everything the label editor needs, in one round trip: the board's labels and the card's set. */
export async function cardLabelsFor(
  userId: string,
  cardId: string,
): Promise<{ available: Label[]; selected: string[] }> {
  const boardId = await requireCardBoardId(userId, cardId);
  const [available, attached] = await Promise.all([
    listBoardLabels(userId, boardId),
    cardLabels(userId, cardId),
  ]);
  return { available, selected: attached.map((label) => label.id) };
}

export async function setCardLabels(
  userId: string,
  cardId: string,
  labelIds: string[],
): Promise<{ available: Label[]; selected: string[] }> {
  const boardId = await requireCardBoardId(userId, cardId);
  const wanted = [...new Set(labelIds)];

  if (wanted.length > 0) {
    const owned = await db
      .select({ id: labels.id })
      .from(labels)
      .where(
        and(eq(labels.user_id, userId), eq(labels.board_id, boardId), inArray(labels.id, wanted)),
      );
    if (owned.length !== wanted.length) throw new BoardError("not_found", "label not found");
  }

  await db
    .delete(card_labels)
    .where(and(eq(card_labels.card_id, cardId), eq(card_labels.user_id, userId)));
  if (wanted.length > 0) {
    await db
      .insert(card_labels)
      .values(wanted.map((labelId) => ({ card_id: cardId, label_id: labelId, user_id: userId })));
  }
  return cardLabelsFor(userId, cardId);
}

/**
 * Every card's labels for one board, in one query — what the card face draws (spec §6.1's card
 * fields include labels). Cards with none are absent rather than empty arrays, like the checklist
 * progress map.
 */
export async function labelsForBoard(
  userId: string,
  boardId: string,
): Promise<Record<string, Label[]>> {
  const rows = await db
    .select({ cardId: card_labels.card_id, label: labels })
    .from(card_labels)
    .innerJoin(labels, eq(labels.id, card_labels.label_id))
    .innerJoin(cards, eq(cards.id, card_labels.card_id))
    .where(
      and(eq(cards.board_id, boardId), eq(cards.user_id, userId), eq(card_labels.user_id, userId)),
    )
    .orderBy(asc(labels.name));

  const byCard: Record<string, Label[]> = {};
  for (const row of rows) (byCard[row.cardId] ??= []).push(row.label);
  return byCard;
}
