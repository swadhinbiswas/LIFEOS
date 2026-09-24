import { and, desc, eq, isNull, ne } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { card_links, cards } from "@/server/db/schema";

/**
 * Card↔card links (spec §6.9, ADR-056). Directed edges with a kind; `card_links` is polymorphic but
 * only card→card ships now. Both endpoints are ownership-checked so a link can never cross tenants.
 */

export type LinkKind = "relates" | "blocks" | "duplicates";
export const LINK_KINDS: readonly LinkKind[] = ["relates", "blocks", "duplicates"];

export interface CardLinkView {
  linkId: string;
  kind: string;
  cardId: string;
  title: string;
}

async function requireOwnedCard(userId: string, cardId: string): Promise<void> {
  const [card] = await db
    .select({ id: cards.id })
    .from(cards)
    .where(and(eq(cards.id, cardId), eq(cards.user_id, userId), isNull(cards.deleted_at)))
    .limit(1);
  if (!card) throw new Error("card not found");
}

/** The open card's outgoing links, with the destination card's title. */
export async function listCardLinks(userId: string, cardId: string): Promise<CardLinkView[]> {
  return db
    .select({
      linkId: card_links.id,
      kind: card_links.link_kind,
      cardId: card_links.dst_id,
      title: cards.title,
    })
    .from(card_links)
    .innerJoin(cards, and(eq(cards.id, card_links.dst_id), eq(cards.user_id, userId)))
    .where(
      and(
        eq(card_links.user_id, userId),
        eq(card_links.src_type, "card"),
        eq(card_links.src_id, cardId),
        eq(card_links.dst_type, "card"),
        isNull(cards.deleted_at),
      ),
    )
    .orderBy(desc(card_links.created_at));
}

/** A picker's worth of the user's other cards, most recently touched first. */
export async function listCardOptions(
  userId: string,
  excludeId: string,
  limit = 100,
): Promise<Array<{ id: string; title: string }>> {
  return db
    .select({ id: cards.id, title: cards.title })
    .from(cards)
    .where(
      and(
        eq(cards.user_id, userId),
        isNull(cards.deleted_at),
        isNull(cards.archived_at),
        ne(cards.id, excludeId),
      ),
    )
    .orderBy(desc(cards.updated_at))
    .limit(limit);
}

export async function createCardLink(
  userId: string,
  input: { srcId: string; dstId: string; kind: LinkKind },
): Promise<void> {
  if (input.srcId === input.dstId) throw new Error("cannot link a card to itself");
  await requireOwnedCard(userId, input.srcId);
  await requireOwnedCard(userId, input.dstId);

  const [existing] = await db
    .select({ id: card_links.id })
    .from(card_links)
    .where(
      and(
        eq(card_links.user_id, userId),
        eq(card_links.src_type, "card"),
        eq(card_links.src_id, input.srcId),
        eq(card_links.dst_type, "card"),
        eq(card_links.dst_id, input.dstId),
        eq(card_links.link_kind, input.kind),
      ),
    )
    .limit(1);
  if (existing) return; // clicking link twice is not a failure

  await db.insert(card_links).values({
    id: newId(),
    user_id: userId,
    src_type: "card",
    src_id: input.srcId,
    dst_type: "card",
    dst_id: input.dstId,
    link_kind: input.kind,
  });
}

export async function deleteCardLink(userId: string, linkId: string): Promise<void> {
  await db.delete(card_links).where(and(eq(card_links.id, linkId), eq(card_links.user_id, userId)));
}
