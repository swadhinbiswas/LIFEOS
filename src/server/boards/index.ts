import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";

import {
  SYSTEM_TASKS_TEMPLATE,
  findBoardTemplate,
  type BoardTemplate,
} from "@/config/board-templates";
import { DEFAULT_CARD_FIELDS, DEFAULT_VIEW_CONFIG } from "@/config/boards";
import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { board_columns, boards, cards } from "@/server/db/schema";

import type {
  CreateBoardInput,
  CreateCardInput,
  CreateColumnInput,
  MoveCardInput,
  MoveColumnInput,
  UpdateBoardInput,
  UpdateCardInput,
  UpdateColumnInput,
} from "./schemas";

/**
 * The board service: the only writer of boards/columns/cards (ADR-042, spec §7.2). Server
 * Actions, REST `/api/v1`, MCP and AI tools all call these functions, so ordering
 * (ADR-009), optimistic concurrency (ADR-011) and tenant scoping live in exactly one place.
 *
 * Every function takes `userId` first and composes `where(user_id = …)` — a query that cannot
 * be scoped to the caller must not exist (spec line 350 / ADR-026).
 */

export type BoardErrorCode = "not_found" | "conflict" | "invalid";

export class BoardError extends Error {
  constructor(
    readonly code: BoardErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BoardError";
  }
}

export type Board = typeof boards.$inferSelect;
export type BoardColumn = typeof board_columns.$inferSelect;
export type Card = typeof cards.$inferSelect;

/** ADR-009 / research (d) §1: rebalance a column once a key outgrows this length. */
export const REBALANCE_THRESHOLD = 128;

/** Insert positions for a fresh set of columns/cards: short, ascending keys (ADR-009). */
function sequentialKeys(count: number): string[] {
  const keys: string[] = [];
  let previous: string | null = null;
  for (let index = 0; index < count; index += 1) {
    const key = generateKeyBetween(previous, null);
    keys.push(key);
    previous = key;
  }
  return keys;
}

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.length > 0 ? base.slice(0, 60) : "board";
}

async function uniqueSlug(userId: string, base: string): Promise<string> {
  const rows = await db
    .select({ slug: boards.slug })
    .from(boards)
    .where(eq(boards.user_id, userId));
  const taken = new Set(rows.map((row) => row.slug));
  if (!taken.has(base)) return base;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${newId().slice(-6).toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------

export async function listBoards(userId: string): Promise<Board[]> {
  return db
    .select()
    .from(boards)
    .where(and(eq(boards.user_id, userId), isNull(boards.deleted_at)))
    .orderBy(asc(boards.created_at));
}

async function requireBoard(userId: string, boardId: string): Promise<Board> {
  const [board] = await db
    .select()
    .from(boards)
    .where(and(eq(boards.id, boardId), eq(boards.user_id, userId), isNull(boards.deleted_at)))
    .limit(1);
  if (!board) throw new BoardError("not_found", "board not found");
  return board;
}

export interface BoardPayload {
  board: Board;
  columns: BoardColumn[];
  /** Live (not trashed, not archived) cards, ordered by column then fractional position. */
  cards: Card[];
}

export async function getBoard(userId: string, boardId: string): Promise<BoardPayload> {
  const board = await requireBoard(userId, boardId);
  const columns = await db
    .select()
    .from(board_columns)
    .where(and(eq(board_columns.board_id, boardId), eq(board_columns.user_id, userId)))
    .orderBy(asc(board_columns.position));
  const cardRows = await db
    .select()
    .from(cards)
    .where(
      and(
        eq(cards.board_id, boardId),
        eq(cards.user_id, userId),
        isNull(cards.deleted_at),
        isNull(cards.archived_at),
      ),
    )
    // ADR-009: byte comparison in SQL — never localeCompare in JS.
    .orderBy(asc(cards.column_id), asc(cards.position));
  return { board, columns, cards: cardRows };
}

async function seedColumns(
  boardId: string,
  userId: string,
  template: BoardTemplate,
): Promise<void> {
  const positions = sequentialKeys(template.columns.length);
  const values = template.columns.map((column, index) => ({
    id: newId(),
    board_id: boardId,
    user_id: userId,
    name: column.name,
    glyph: column.glyph ?? null,
    color: null,
    position: positions[index] ?? generateKeyBetween(null, null),
    wip_limit: column.wipLimit ?? null,
    is_done: column.isDone ?? false,
  }));
  if (values.length > 0) await db.insert(board_columns).values(values);
}

export async function createBoard(userId: string, input: CreateBoardInput): Promise<Board> {
  const template = input.template ? findBoardTemplate(input.template) : findBoardTemplate("blank");
  if (!template) throw new BoardError("invalid", `unknown board template: ${input.template}`);

  const [row] = await db
    .insert(boards)
    .values({
      id: newId(),
      user_id: userId,
      name: input.name,
      slug: await uniqueSlug(userId, slugify(input.name)),
      template: template.id,
      view_config: JSON.stringify(DEFAULT_VIEW_CONFIG),
      card_fields: JSON.stringify(DEFAULT_CARD_FIELDS),
      is_system: false,
    })
    .returning();
  if (!row) throw new BoardError("invalid", "board insert returned no row");

  await seedColumns(row.id, userId, template);
  return row;
}

/**
 * The per-user Tasks board (ADR-042): created lazily on first `/tasks` or `/inbox` visit and
 * never listed as a user board. Columns: Inbox / Today / Upcoming / Someday / Done.
 */
export async function ensureSystemTasksBoard(userId: string): Promise<Board> {
  const [existing] = await db
    .select()
    .from(boards)
    .where(and(eq(boards.user_id, userId), eq(boards.is_system, true)))
    .limit(1);
  if (existing) return existing;

  const [row] = await db
    .insert(boards)
    .values({
      id: newId(),
      user_id: userId,
      name: SYSTEM_TASKS_TEMPLATE.name,
      slug: await uniqueSlug(userId, "tasks"),
      template: SYSTEM_TASKS_TEMPLATE.id,
      view_config: JSON.stringify(DEFAULT_VIEW_CONFIG),
      card_fields: JSON.stringify(DEFAULT_CARD_FIELDS),
      is_system: true,
    })
    .returning();
  if (!row) throw new BoardError("invalid", "system board insert returned no row");

  await seedColumns(row.id, userId, SYSTEM_TASKS_TEMPLATE);
  return row;
}

export async function updateBoard(userId: string, input: UpdateBoardInput): Promise<Board> {
  await requireBoard(userId, input.boardId);
  const patch: Partial<typeof boards.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.archived !== undefined) patch.archived_at = input.archived ? new Date() : null;
  if (Object.keys(patch).length === 0) return requireBoard(userId, input.boardId);

  const [row] = await db
    .update(boards)
    .set(patch)
    .where(and(eq(boards.id, input.boardId), eq(boards.user_id, userId)))
    .returning();
  if (!row) throw new BoardError("not_found", "board not found");
  return row;
}

export async function deleteBoard(userId: string, boardId: string): Promise<void> {
  const board = await requireBoard(userId, boardId);
  if (board.is_system) throw new BoardError("invalid", "the Tasks board cannot be deleted");
  await db
    .update(boards)
    .set({ deleted_at: new Date() })
    .where(and(eq(boards.id, boardId), eq(boards.user_id, userId)));
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

export async function createColumn(userId: string, input: CreateColumnInput): Promise<BoardColumn> {
  await requireBoard(userId, input.boardId);
  const [last] = await db
    .select({ position: board_columns.position })
    .from(board_columns)
    .where(and(eq(board_columns.board_id, input.boardId), eq(board_columns.user_id, userId)))
    .orderBy(desc(board_columns.position))
    .limit(1);

  const [row] = await db
    .insert(board_columns)
    .values({
      id: newId(),
      board_id: input.boardId,
      user_id: userId,
      name: input.name,
      color: input.color ?? null,
      glyph: input.glyph ?? null,
      position: generateKeyBetween(last?.position ?? null, null),
      wip_limit: input.wipLimit ?? null,
      is_done: input.isDone ?? false,
    })
    .returning();
  if (!row) throw new BoardError("invalid", "column insert returned no row");
  return row;
}

export async function updateColumn(userId: string, input: UpdateColumnInput): Promise<BoardColumn> {
  const patch: Partial<typeof board_columns.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.color !== undefined) patch.color = input.color;
  if (input.glyph !== undefined) patch.glyph = input.glyph;
  if (input.wipLimit !== undefined) patch.wip_limit = input.wipLimit;
  if (input.isDone !== undefined) patch.is_done = input.isDone;

  const [row] = await db
    .update(board_columns)
    .set(patch)
    .where(and(eq(board_columns.id, input.columnId), eq(board_columns.user_id, userId)))
    .returning();
  if (!row) throw new BoardError("not_found", "column not found");
  return row;
}

async function columnPosition(userId: string, columnId: string, boardId: string): Promise<string> {
  const [row] = await db
    .select({ position: board_columns.position })
    .from(board_columns)
    .where(
      and(
        eq(board_columns.id, columnId),
        eq(board_columns.user_id, userId),
        eq(board_columns.board_id, boardId),
      ),
    )
    .limit(1);
  if (!row) throw new BoardError("not_found", "column not found");
  return row.position;
}

export async function moveColumn(userId: string, input: MoveColumnInput): Promise<BoardColumn> {
  const [column] = await db
    .select()
    .from(board_columns)
    .where(and(eq(board_columns.id, input.columnId), eq(board_columns.user_id, userId)))
    .limit(1);
  if (!column) throw new BoardError("not_found", "column not found");

  const neighbourId = input.prevColumnId ?? input.nextColumnId;
  if (neighbourId === column.id) {
    throw new BoardError("invalid", "a column cannot be its own neighbour");
  }
  const prevKey = input.prevColumnId
    ? await columnPosition(userId, input.prevColumnId, column.board_id)
    : null;
  const nextKey = input.nextColumnId
    ? await columnPosition(userId, input.nextColumnId, column.board_id)
    : null;
  if (prevKey && nextKey && prevKey >= nextKey) {
    throw new BoardError("invalid", "neighbour columns are out of order");
  }

  const [row] = await db
    .update(board_columns)
    .set({ position: generateKeyBetween(prevKey, nextKey) })
    .where(and(eq(board_columns.id, column.id), eq(board_columns.user_id, userId)))
    .returning();
  if (!row) throw new BoardError("not_found", "column not found");
  return row;
}

export async function deleteColumn(userId: string, columnId: string): Promise<void> {
  const [column] = await db
    .select()
    .from(board_columns)
    .where(and(eq(board_columns.id, columnId), eq(board_columns.user_id, userId)))
    .limit(1);
  if (!column) throw new BoardError("not_found", "column not found");

  const [occupied] = await db
    .select({ id: cards.id })
    .from(cards)
    .where(and(eq(cards.column_id, columnId), eq(cards.user_id, userId), isNull(cards.deleted_at)))
    .limit(1);
  if (occupied) throw new BoardError("invalid", "move or delete the cards in this column first");

  await db
    .delete(board_columns)
    .where(and(eq(board_columns.id, columnId), eq(board_columns.user_id, userId)));
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

async function requireCard(userId: string, cardId: string): Promise<Card> {
  const [card] = await db
    .select()
    .from(cards)
    .where(and(eq(cards.id, cardId), eq(cards.user_id, userId), isNull(cards.deleted_at)))
    .limit(1);
  if (!card) throw new BoardError("not_found", "card not found");
  return card;
}

/** Position of a card that must live in the destination column (move neighbours). */
async function cardPositionInColumn(
  userId: string,
  cardId: string,
  columnId: string,
): Promise<string> {
  const [row] = await db
    .select({ position: cards.position })
    .from(cards)
    .where(
      and(
        eq(cards.id, cardId),
        eq(cards.user_id, userId),
        eq(cards.column_id, columnId),
        isNull(cards.deleted_at),
      ),
    )
    .limit(1);
  if (!row) throw new BoardError("not_found", "neighbour card not found in that column");
  return row.position;
}

export async function createCard(userId: string, input: CreateCardInput): Promise<Card> {
  await requireBoard(userId, input.boardId);
  const [column] = await db
    .select({ id: board_columns.id })
    .from(board_columns)
    .where(
      and(
        eq(board_columns.id, input.columnId),
        eq(board_columns.user_id, userId),
        eq(board_columns.board_id, input.boardId),
      ),
    )
    .limit(1);
  if (!column) throw new BoardError("not_found", "column not found on that board");

  const [last] = await db
    .select({ position: cards.position })
    .from(cards)
    .where(
      and(eq(cards.column_id, input.columnId), eq(cards.user_id, userId), isNull(cards.deleted_at)),
    )
    .orderBy(desc(cards.position))
    .limit(1);

  const [row] = await db
    .insert(cards)
    .values({
      id: newId(),
      board_id: input.boardId,
      column_id: input.columnId,
      user_id: userId,
      position: generateKeyBetween(last?.position ?? null, null),
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? null,
      due_at: input.dueAt ?? null,
      start_at: input.startAt ?? null,
      estimate_min: input.estimateMin ?? null,
      recurrence: input.recurrence ?? null,
      kind: input.kind ?? "task",
      meta: input.meta ? JSON.stringify(input.meta) : null,
      version: 1,
    })
    .returning();
  if (!row) throw new BoardError("invalid", "card insert returned no row");
  return row;
}

export async function updateCard(userId: string, input: UpdateCardInput): Promise<Card> {
  const patch: Partial<typeof cards.$inferInsert> = { version: input.version + 1 };
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.dueAt !== undefined) patch.due_at = input.dueAt;
  if (input.startAt !== undefined) patch.start_at = input.startAt;
  if (input.estimateMin !== undefined) patch.estimate_min = input.estimateMin;
  if (input.recurrence !== undefined) patch.recurrence = input.recurrence;
  if (input.meta !== undefined)
    patch.meta = input.meta === null ? null : JSON.stringify(input.meta);

  const updated = await db
    .update(cards)
    .set(patch)
    .where(
      and(
        eq(cards.id, input.cardId),
        eq(cards.user_id, userId),
        eq(cards.version, input.version),
        isNull(cards.deleted_at),
      ),
    )
    .returning();

  const row = updated[0];
  if (row) return row;

  // 0 rows means the card is gone or somebody else wrote first (ADR-011).
  await requireCard(userId, input.cardId);
  throw new BoardError("conflict", "card changed since you loaded it");
}

export async function moveCard(userId: string, input: MoveCardInput): Promise<Card> {
  const card = await requireCard(userId, input.cardId);
  if (card.version !== input.version) {
    throw new BoardError("conflict", "card changed since you loaded it");
  }

  const [column] = await db
    .select()
    .from(board_columns)
    .where(
      and(
        eq(board_columns.id, input.toColumnId),
        eq(board_columns.user_id, userId),
        eq(board_columns.board_id, card.board_id),
      ),
    )
    .limit(1);
  if (!column) throw new BoardError("not_found", "destination column not found on that board");

  if (input.prevCardId === card.id || input.nextCardId === card.id) {
    throw new BoardError("invalid", "a card cannot be its own neighbour");
  }

  // Dropping into a `done` column completes the card; leaving one re-opens it (spec §6.1).
  const completedAt = column.is_done ? (card.completed_at ?? new Date()) : null;

  /**
   * ADR-009: one-row UPDATE between two keys, retrying on a UNIQUE collision. Neighbour keys
   * are re-read each attempt — a concurrent insert changes the gap, so the retry produces a
   * different key rather than the same one again.
   */
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const prevKey = input.prevCardId
      ? await cardPositionInColumn(userId, input.prevCardId, column.id)
      : null;
    const nextKey = input.nextCardId
      ? await cardPositionInColumn(userId, input.nextCardId, column.id)
      : null;

    let position: string;
    if (prevKey && nextKey && prevKey >= nextKey) {
      // Neighbours drifted out of order (or the same key twice) — append as a safe fallback.
      position = generateKeyBetween(prevKey, null);
    } else {
      position = generateKeyBetween(prevKey, nextKey);
    }

    const updated = await db
      .update(cards)
      .set({
        column_id: column.id,
        position,
        completed_at: completedAt,
        version: card.version + 1,
      })
      .where(
        and(
          eq(cards.id, card.id),
          eq(cards.user_id, userId),
          eq(cards.version, card.version),
          isNull(cards.deleted_at),
        ),
      )
      .returning();

    const row = updated[0];
    if (row) return row;

    const fresh = await requireCard(userId, card.id);
    if (fresh.version !== card.version) {
      throw new BoardError("conflict", "card changed since you loaded it");
    }
    // Otherwise the key was taken: rebalance and try once more with a clean column.
    await rebalanceColumn(userId, column.id);
  }

  throw new BoardError("conflict", "could not place the card — please retry");
}

/** Soft delete (spec §6.1: 30-day Trash). The key stays with the row via the partial index. */
export async function deleteCard(userId: string, cardId: string): Promise<void> {
  const card = await requireCard(userId, cardId);
  await db
    .update(cards)
    .set({ deleted_at: new Date(), version: card.version + 1 })
    .where(and(eq(cards.id, card.id), eq(cards.user_id, userId)));
}

export async function archiveCard(userId: string, cardId: string): Promise<void> {
  const card = await requireCard(userId, cardId);
  await db
    .update(cards)
    .set({ archived_at: new Date(), version: card.version + 1 })
    .where(and(eq(cards.id, card.id), eq(cards.user_id, userId)));
}

export async function restoreCard(userId: string, cardId: string): Promise<void> {
  await db
    .update(cards)
    .set({ deleted_at: null, archived_at: null, version: 1 })
    .where(and(eq(cards.id, cardId), eq(cards.user_id, userId)));
}

/**
 * Rebuild one column's keys as short ascending strings (ADR-009). Idempotent and cheap for the
 * sizes a board actually reaches; positions are not bumped (`version` stays put, so optimistic
 * caches do not conflict).
 */
export async function rebalanceColumn(userId: string, columnId: string): Promise<number> {
  const rows = await db
    .select({ id: cards.id })
    .from(cards)
    .where(and(eq(cards.column_id, columnId), eq(cards.user_id, userId), isNull(cards.deleted_at)))
    .orderBy(asc(cards.position));

  const keys = sequentialKeys(rows.length);
  await Promise.all(
    rows.map((row, index) =>
      db
        .update(cards)
        .set({ position: keys[index] ?? generateKeyBetween(null, null) })
        .where(and(eq(cards.id, row.id), eq(cards.user_id, userId))),
    ),
  );
  return rows.length;
}

/** True when any key in the column has grown past the ADR-009 threshold. */
export function needsRebalance(positions: string[]): boolean {
  return positions.some((position) => position.length >= REBALANCE_THRESHOLD);
}
