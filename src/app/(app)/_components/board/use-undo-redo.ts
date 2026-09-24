"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

import {
  deleteCardAction,
  restoreCardAction,
  revertMoveAction,
  revertUpdateAction,
} from "@/server/boards/actions";

import { useBoardHistory, type HistoryEntry } from "./board-history";
import { boardQueryKey } from "./use-board";

/**
 * Replay one recorded intent through the version-free reversal actions. Create and remove mirror
 * each other: undo a create by trashing the card, redo it by restoring it (and the same pair the
 * other way for a delete) — so both directions work off the one soft-delete path the trash owns.
 */
async function applyEntry(entry: HistoryEntry, direction: "undo" | "redo"): Promise<void> {
  const undo = direction === "undo";
  switch (entry.kind) {
    case "move": {
      const target = undo ? entry.from : entry.to;
      const result = await revertMoveAction({
        cardId: entry.cardId,
        toColumnId: target.columnId,
        prevCardId: target.prevCardId,
        nextCardId: target.nextCardId,
      });
      if (!result.ok) throw new Error(result.message);
      return;
    }
    case "create": {
      const result = undo
        ? await deleteCardAction({ cardId: entry.cardId })
        : await restoreCardAction({ cardId: entry.cardId });
      if (!result.ok) throw new Error(result.message);
      return;
    }
    case "remove": {
      const result = undo
        ? await restoreCardAction({ cardId: entry.cardId })
        : await deleteCardAction({ cardId: entry.cardId });
      if (!result.ok) throw new Error(result.message);
      return;
    }
    case "update": {
      const values = undo ? entry.before : entry.after;
      const result = await revertUpdateAction({ cardId: entry.cardId, ...values });
      if (!result.ok) throw new Error(result.message);
    }
  }
}

export function useUndoRedo(boardId: string) {
  const queryClient = useQueryClient();
  // Stable identities: `undo`/`redo` feed the board key handler, and a new identity each render
  // would re-subscribe it constantly (and can drop a keystroke under load).
  const key = useMemo(() => boardQueryKey(boardId), [boardId]);
  const stacks = useBoardHistory((state) => state.stacks[boardId]);

  const run = useCallback(
    async (direction: "undo" | "redo") => {
      // Drop any in-flight refetch first: a settle from the action being undone must not land
      // over the reversal and resurrect the old position.
      await queryClient.cancelQueries({ queryKey: key });
      const store = useBoardHistory.getState();
      const entry = store.take(boardId, direction);
      if (!entry) return;
      try {
        await applyEntry(entry, direction);
        store.settle(boardId, direction, entry);
      } catch {
        // Keep the action so pressing again retries instead of losing it.
        store.settle(boardId, direction === "undo" ? "redo" : "undo", entry);
        toast.warning(direction === "undo" ? "could not undo that" : "could not redo that");
      } finally {
        await queryClient.invalidateQueries({ queryKey: key });
        await queryClient.invalidateQueries({ queryKey: ["trash"] });
      }
    },
    [boardId, key, queryClient],
  );

  return {
    canUndo: (stacks?.undo.length ?? 0) > 0,
    canRedo: (stacks?.redo.length ?? 0) > 0,
    undoCount: stacks?.undo.length ?? 0,
    redoCount: stacks?.redo.length ?? 0,
    undo: useCallback(() => void run("undo"), [run]),
    redo: useCallback(() => void run("redo"), [run]),
  };
}
