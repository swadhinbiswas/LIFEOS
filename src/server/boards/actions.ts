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
  cardIdInput,
  createBoardInput,
  createCardInput,
  moveCardInput,
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
import { getServerSession } from "@/server/auth/session";
import type { Board } from "@/server/boards";

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
