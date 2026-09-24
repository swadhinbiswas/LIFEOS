import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/server/db";
import { cards } from "@/server/db/schema";

import { BoardError, moveCard, updateCard, type Card } from "./index";
import type { UpdateCardInput } from "./schemas";

/**
 * Reversal entry points for the undo/redo stack (spec §6.1). They exist so the client never has
 * to replay a *version*: the stack stores intent ("put it back between these two"), and the
 * service reads the card's current version here. That removes the whole class of "undo failed
 * because a refetch landed mid-flight" races, and keeps every write going through `moveCard` /
 * `updateCard` (ADR-009 retry, ADR-011 checks).
 */

async function requireCard(userId: string, cardId: string): Promise<Card> {
  const [card] = await db
    .select()
    .from(cards)
    .where(and(eq(cards.id, cardId), eq(cards.user_id, userId), isNull(cards.deleted_at)))
    .limit(1);
  if (!card) throw new BoardError("not_found", "card not found");
  return card;
}

export interface RevertMoveInput {
  cardId: string;
  toColumnId: string;
  prevCardId: string | null;
  nextCardId: string | null;
}

export async function revertMove(userId: string, input: RevertMoveInput): Promise<Card> {
  const card = await requireCard(userId, input.cardId);
  return moveCard(userId, {
    cardId: input.cardId,
    version: card.version,
    toColumnId: input.toColumnId,
    prevCardId: input.prevCardId,
    nextCardId: input.nextCardId,
  });
}

type RevertableFields = Omit<UpdateCardInput, "cardId" | "version">;

export async function revertUpdate(
  userId: string,
  input: { cardId: string } & RevertableFields,
): Promise<Card> {
  const card = await requireCard(userId, input.cardId);
  const { cardId, ...fields } = input;
  return updateCard(userId, { cardId, version: card.version, ...fields });
}
