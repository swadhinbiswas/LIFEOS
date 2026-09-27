"use server";

import { ZodError } from "zod";

import type { BoardPayload } from "@/server/boards";
import {
  BoardError,
  archiveCard as archiveCardService,
  createBoard as createBoardService,
  createCard as createCardService,
  deleteBoard as deleteBoardService,
  deleteCard as deleteCardService,
  ensureSystemTasksBoard,
  getBoard as getBoardService,
  listBoards as listBoardsService,
  moveCard as moveCardService,
  restoreCard as restoreCardService,
  updateCard as updateCardService,
} from "@/server/boards";
import {
  addChecklistItemInput,
  cardIdInput,
  boardIdInput,
  checklistItemDoneInput,
  checklistItemIdInput,
  checklistItemTextInput,
  createBoardInput,
  createCardInput,
  moveCardInput,
  revertMoveInput,
  revertUpdateInput,
  savedViewIdInput,
  savedViewInput,
  savedViewScopeInput,
  updateCardInput,
} from "@/server/boards/schemas";
import {
  createSavedView,
  deleteSavedView,
  listSavedViews,
  type SavedView,
} from "@/server/boards/views";
import {
  addChecklistItem,
  listCardChecklist,
  removeChecklistItem,
  setChecklistItemDone,
  setChecklistItemText,
  type CardChecklist,
} from "@/server/boards/checklists";
import { carryOverOverdue } from "@/server/boards/brief";
import { revertMove, revertUpdate } from "@/server/boards/revert";
import { listTrash, purgeCard, purgeTrash } from "@/server/boards/trash";
import type { Card } from "@/server/boards";
import { getServerSession } from "@/server/auth/session";
import type { Board } from "@/server/boards";
import { getTimeZone } from "@/server/settings";

/**
 * Thin Server-Action adapter over the board service (spec §7.2, ADR-042). Actions never throw
 * to the client — Next sanitizes server error messages in production, so failures cross the
 * boundary as a discriminated result the UI can toast and roll back on.
 */

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: "unauthorized" | "invalid" | "not_found" | "conflict"; message: string };

async function run<T>(fn: (userId: string) => Promise<T>): Promise<ActionResult<T>> {
  const session = await getServerSession();
  if (!session) {
    return { ok: false, code: "unauthorized", message: "you are signed out — sign in again" };
  }
  try {
    return { ok: true, data: await fn(session.user.id) };
  } catch (error) {
    if (error instanceof BoardError) {
      return { ok: false, code: error.code, message: error.message };
    }
    if (error instanceof ZodError) {
      return { ok: false, code: "invalid", message: "that input is not valid" };
    }
    console.error("[boards] action failed", error);
    return { ok: false, code: "invalid", message: "something went wrong — please retry" };
  }
}

export async function fetchBoardAction(boardId: string): Promise<ActionResult<BoardPayload>> {
  return run((userId) => getBoardService(userId, boardId));
}

/** Subtasks (spec §6.1). Each returns the whole checklist, so the client caches one shape. */
export async function listCardChecklistAction(
  input: unknown,
): Promise<ActionResult<CardChecklist>> {
  return run((userId) => listCardChecklist(userId, cardIdInput.parse(input).cardId));
}

export async function addChecklistItemAction(input: unknown): Promise<ActionResult<CardChecklist>> {
  return run((userId) => {
    const { cardId, text } = addChecklistItemInput.parse(input);
    return addChecklistItem(userId, cardId, text);
  });
}

export async function setChecklistItemDoneAction(
  input: unknown,
): Promise<ActionResult<CardChecklist>> {
  return run((userId) => {
    const { itemId, done } = checklistItemDoneInput.parse(input);
    return setChecklistItemDone(userId, itemId, done);
  });
}

export async function setChecklistItemTextAction(
  input: unknown,
): Promise<ActionResult<CardChecklist>> {
  return run((userId) => {
    const { itemId, text } = checklistItemTextInput.parse(input);
    return setChecklistItemText(userId, itemId, text);
  });
}

export async function removeChecklistItemAction(
  input: unknown,
): Promise<ActionResult<CardChecklist>> {
  return run((userId) => removeChecklistItem(userId, checklistItemIdInput.parse(input).itemId));
}

export async function listBoardsAction(): Promise<ActionResult<Board[]>> {
  return run((userId) => listBoardsService(userId));
}

export async function ensureTasksBoardAction(): Promise<ActionResult<BoardPayload>> {
  return run(async (userId) => {
    const board = await ensureSystemTasksBoard(userId);
    return getBoardService(userId, board.id);
  });
}

export async function createBoardAction(input: unknown): Promise<ActionResult<Board>> {
  return run((userId) => createBoardService(userId, createBoardInput.parse(input)));
}

export async function deleteBoardAction(boardId: string): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await deleteBoardService(userId, boardId);
    return null;
  });
}

export async function createCardAction(
  input: unknown,
): Promise<ActionResult<BoardPayload["cards"][number]>> {
  return run((userId) => createCardService(userId, createCardInput.parse(input)));
}

export async function updateCardAction(
  input: unknown,
): Promise<ActionResult<BoardPayload["cards"][number]>> {
  return run((userId) => updateCardService(userId, updateCardInput.parse(input)));
}

export async function moveCardAction(
  input: unknown,
): Promise<ActionResult<BoardPayload["cards"][number]>> {
  return run((userId) => moveCardService(userId, moveCardInput.parse(input)));
}

export async function archiveCardAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await archiveCardService(userId, cardIdInput.parse(input).cardId);
    return null;
  });
}

export async function deleteCardAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await deleteCardService(userId, cardIdInput.parse(input).cardId);
    return null;
  });
}

export async function restoreCardAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await restoreCardService(userId, cardIdInput.parse(input).cardId);
    return null;
  });
}

export async function carryOverAction(): Promise<ActionResult<{ moved: number }>> {
  return run(async (userId) => ({
    moved: await carryOverOverdue(userId, new Date(), await getTimeZone(userId)),
  }));
}

export async function listTrashAction(input: unknown): Promise<ActionResult<Card[]>> {
  return run((userId) => listTrash(userId, boardIdInput.parse(input).boardId));
}

export async function purgeTrashAction(): Promise<ActionResult<{ removed: number }>> {
  return run(async (userId) => ({ removed: await purgeTrash(userId) }));
}

export async function purgeCardAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await purgeCard(userId, cardIdInput.parse(input).cardId);
    return null;
  });
}

/**
 * Undo/redo adapters. They take no version from the client: the stack stores intent and the
 * service reads the current version, so an undo cannot fail because a refetch moved it on.
 */
export async function revertMoveAction(input: unknown): Promise<ActionResult<Card>> {
  return run((userId) => revertMove(userId, revertMoveInput.parse(input)));
}

export async function revertUpdateAction(input: unknown): Promise<ActionResult<Card>> {
  return run((userId) => revertUpdate(userId, revertUpdateInput.parse(input)));
}

export async function listSavedViewsAction(input: unknown): Promise<ActionResult<SavedView[]>> {
  return run((userId) => listSavedViews(userId, savedViewScopeInput.parse(input).scope));
}

export async function createSavedViewAction(input: unknown): Promise<ActionResult<SavedView>> {
  return run((userId) => createSavedView(userId, savedViewInput.parse(input)));
}

export async function deleteSavedViewAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await deleteSavedView(userId, savedViewIdInput.parse(input).id);
    return null;
  });
}
