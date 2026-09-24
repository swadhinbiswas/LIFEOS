import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { boards, cards } from "@/server/db/schema";

/**
 * Command-palette search (spec §4.3: "fuzzy search across all entities"). Phase 2 owns cards
 * and boards; later phases add their entities to the same result shape, so the palette never
 * needs to know which module answered.
 *
 * Matching is a case-insensitive `LIKE` with the user's own wildcards escaped, ordered by
 * recency, capped per group — a palette wants the best few hits, not a report.
 */

export interface CardHit {
  id: string;
  title: string;
  boardId: string;
  boardName: string;
  /** The system Tasks board gets the `/tasks` route instead of `/boards/[id]`. */
  isSystem: boolean;
}

export interface BoardHit {
  id: string;
  name: string;
}

export interface SearchResults {
  cards: CardHit[];
  boards: BoardHit[];
}

/** `%`/`_`/`\` are LIKE syntax; a user typing them must not turn into a wildcard. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export async function search(userId: string, query: string, limit = 8): Promise<SearchResults> {
  const trimmed = query.trim();
  if (trimmed === "") return { cards: [], boards: [] };

  const pattern = `%${escapeLike(trimmed.toLowerCase())}%`;

  const cardRows = await db
    .select({
      id: cards.id,
      title: cards.title,
      boardId: cards.board_id,
      boardName: boards.name,
      isSystem: boards.is_system,
    })
    .from(cards)
    .innerJoin(boards, eq(cards.board_id, boards.id))
    .where(
      and(
        eq(cards.user_id, userId),
        isNull(cards.deleted_at),
        isNull(cards.archived_at),
        isNull(boards.deleted_at),
        sql`lower(${cards.title}) like ${pattern} escape '\\'`,
      ),
    )
    .orderBy(sql`${cards.updated_at} desc`)
    .limit(limit);

  const boardRows = await db
    .select({ id: boards.id, name: boards.name })
    .from(boards)
    .where(
      and(
        eq(boards.user_id, userId),
        isNull(boards.deleted_at),
        sql`lower(${boards.name}) like ${pattern} escape '\\'`,
      ),
    )
    .orderBy(asc(boards.name))
    .limit(limit);

  return {
    cards: cardRows.map((row) => ({
      id: row.id,
      title: row.title,
      boardId: row.boardId,
      boardName: row.boardName,
      isSystem: Boolean(row.isSystem),
    })),
    boards: boardRows,
  };
}
