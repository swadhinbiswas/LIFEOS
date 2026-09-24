"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { generateKeyBetween } from "fractional-indexing";
import { toast } from "sonner";

import type { BoardPayload } from "@/server/boards";
import {
  archiveCardAction,
  createCardAction,
  deleteCardAction,
  fetchBoardAction,
  moveCardAction,
  restoreCardAction,
  updateCardAction,
  type ActionResult,
} from "@/server/boards/actions";

/**
 * Server state for one board (ADR-042): one query key `["board", id]`, mutations that apply
 * the change to the cache first and roll it back when the server refuses.
 *
 * A refused write crosses the Server-Action boundary as a result object (Next sanitizes thrown
 * messages in production), so `unwrap` turns it back into an error for TanStack to handle.
 */

export class BoardMutationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BoardMutationError";
  }
}

function unwrap<T>(result: ActionResult<T>): T {
  if (result.ok) return result.data;
  throw new BoardMutationError(result.code, result.message);
}

function describe(error: unknown): { title: string; description?: string } {
  if (error instanceof BoardMutationError) {
    if (error.code === "conflict") {
      return { title: "someone changed that first", description: error.message };
    }
    return { title: error.message };
  }
  return { title: "something went wrong — please retry" };
}

export const boardQueryKey = (boardId: string) => ["board", boardId] as const;

export interface MoveCardVars {
  cardId: string;
  version: number;
  toColumnId: string;
  prevCardId: string | null;
  nextCardId: string | null;
}

export interface CreateCardVars {
  columnId: string;
  title: string;
}

export interface UpdateCardVars {
  cardId: string;
  version: number;
  title?: string;
  description?: string | null;
  priority?: string | null;
  dueAt?: string | null;
  startAt?: string | null;
  estimateMin?: number | null;
  recurrence?: string | null;
}

const byPosition = (a: { position: string }, b: { position: string }) =>
  a.position < b.position ? -1 : a.position > b.position ? 1 : 0;

/** Last position in a column, for appending optimistically. */
const lastPosition = (payload: BoardPayload, columnId: string): string | null => {
  const inColumn = payload.cards.filter((card) => card.column_id === columnId).sort(byPosition);
  return inColumn.at(-1)?.position ?? null;
};

export function useBoard(boardId: string, initialData: BoardPayload) {
  const queryClient = useQueryClient();
  const key = boardQueryKey(boardId);

  const query = useQuery({
    queryKey: key,
    queryFn: async () => unwrap(await fetchBoardAction(boardId)),
    initialData,
  });

  const snapshot = () => queryClient.getQueryData<BoardPayload>(key);
  const restore = (previous: BoardPayload | undefined) => {
    if (previous) queryClient.setQueryData(key, previous);
  };
  const settle = () => {
    void queryClient.invalidateQueries({ queryKey: key });
  };
  const fail = (error: unknown) => {
    const { title, description } = describe(error);
    toast.warning(title, description ? { description } : undefined);
  };

  const moveCard = useMutation({
    mutationFn: async (vars: MoveCardVars) => unwrap(await moveCardAction(vars)),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = snapshot();
      queryClient.setQueryData<BoardPayload>(key, (current) => {
        if (!current) return current;
        const prevCard = vars.prevCardId
          ? current.cards.find((card) => card.id === vars.prevCardId)
          : undefined;
        const nextCard = vars.nextCardId
          ? current.cards.find((card) => card.id === vars.nextCardId)
          : undefined;
        const destination = current.columns.find((column) => column.id === vars.toColumnId);
        return {
          ...current,
          cards: current.cards.map((card) =>
            card.id === vars.cardId
              ? {
                  ...card,
                  column_id: vars.toColumnId,
                  position: generateKeyBetween(
                    prevCard?.position ?? null,
                    nextCard?.position ?? null,
                  ),
                  completed_at: destination?.is_done ? (card.completed_at ?? new Date()) : null,
                  version: card.version + 1,
                }
              : card,
          ),
        };
      });
      return { previous };
    },
    onError: (error, _vars, context) => {
      restore(context?.previous);
      fail(error);
    },
    onSettled: settle,
  });

  const createCard = useMutation({
    mutationFn: async (vars: CreateCardVars) =>
      unwrap(await createCardAction({ boardId, columnId: vars.columnId, title: vars.title })),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = snapshot();
      queryClient.setQueryData<BoardPayload>(key, (current) => {
        if (!current) return current;
        const now = new Date();
        return {
          ...current,
          cards: [
            ...current.cards,
            {
              id: `pending-${vars.columnId}-${now.getTime()}`,
              board_id: boardId,
              column_id: vars.columnId,
              user_id: "",
              workspace_id: null,
              position: generateKeyBetween(lastPosition(current, vars.columnId), null),
              title: vars.title,
              description: null,
              priority: null,
              due_at: null,
              start_at: null,
              estimate_min: null,
              completed_at: null,
              archived_at: null,
              deleted_at: null,
              recurrence: null,
              kind: "task",
              meta: null,
              version: 1,
              is_demo: false,
              created_at: now,
              updated_at: now,
            },
          ],
        };
      });
      return { previous };
    },
    onError: (error, _vars, context) => {
      restore(context?.previous);
      fail(error);
    },
    onSettled: settle,
  });

  const updateCard = useMutation({
    mutationFn: async (vars: UpdateCardVars) => unwrap(await updateCardAction(vars)),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = snapshot();
      queryClient.setQueryData<BoardPayload>(key, (current) => {
        if (!current) return current;
        const toDate = (value: string | null | undefined, existing: Date | null) =>
          value === undefined ? existing : value === null ? null : new Date(value);
        return {
          ...current,
          cards: current.cards.map((card) =>
            card.id === vars.cardId
              ? {
                  ...card,
                  title: vars.title ?? card.title,
                  description: vars.description !== undefined ? vars.description : card.description,
                  priority: vars.priority !== undefined ? vars.priority : card.priority,
                  due_at: toDate(vars.dueAt, card.due_at),
                  start_at: toDate(vars.startAt, card.start_at),
                  estimate_min:
                    vars.estimateMin !== undefined ? vars.estimateMin : card.estimate_min,
                  recurrence: vars.recurrence !== undefined ? vars.recurrence : card.recurrence,
                  version: card.version + 1,
                }
              : card,
          ),
        };
      });
      return { previous };
    },
    onError: (error, _vars, context) => {
      restore(context?.previous);
      fail(error);
    },
    onSettled: settle,
  });

  const restoreCard = useMutation({
    mutationFn: async (vars: { cardId: string }) => unwrap(await restoreCardAction(vars)),
    onError: fail,
    onSettled: settle,
  });

  const removeCard = useMutation({
    mutationFn: async (vars: { cardId: string; archive?: boolean }) =>
      vars.archive
        ? unwrap(await archiveCardAction({ cardId: vars.cardId }))
        : unwrap(await deleteCardAction({ cardId: vars.cardId })),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = snapshot();
      queryClient.setQueryData<BoardPayload>(key, (current) =>
        current
          ? { ...current, cards: current.cards.filter((card) => card.id !== vars.cardId) }
          : current,
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      restore(context?.previous);
      fail(error);
    },
    onSuccess: (_data, vars) => {
      if (vars.archive) return;
      // Forgiving by default (spec §6.1): destructive writes are one toast away from undone.
      toast("card moved to trash", {
        description: "restore it any time within 30 days",
        action: { label: "undo", onClick: () => restoreCard.mutate({ cardId: vars.cardId }) },
      });
    },
    onSettled: settle,
  });

  return {
    payload: query.data,
    isFetching: query.isFetching,
    moveCard,
    createCard,
    updateCard,
    removeCard,
    restoreCard,
  };
}
