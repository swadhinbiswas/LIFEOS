"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  deleteCardAction,
  restoreCardAction,
  revertMoveAction,
  revertUpdateAction,
} from "@/server/boards/actions";

import { useBoardHistory, type HistoryEntry } from "./board-history";
import { boardQueryKey } from "./use-board";

/** Replay one recorded intent through the version-free reversal actions. */
async function applyEntry(entry: HistoryEntry, direction: "undo" | "redo"): Promise<void> {
  switch (entry.kind) {
    case "move": {
      const target = direction === "undo" ? entry.from : entry.to;
      const result = await revertMoveAction({ cardId: entry.cardId, ...target });
      if (!result.ok) throw new Error(result.message);
      return;
    }
    case "create": {
      const result = await deleteCardAction({ cardId: entry.cardId });
      if (!result.ok) throw new Error(result.message);
      return;
    }
    case "remove": {
      const result = await restoreCardAction({ cardId: entry.cardId });
      if (!result.ok) throw new Error(result.message);
      return;
    }
    case "update": {
      const values = direction === "undo" ? entry.before : entry.after;
      const result = await revertUpdateAction({ cardId: entry.cardId, ...values });
      if (!result.ok) throw new Error(result.message);
    }
  }
}

export function useUndoRedo(boardId: string) {
  const queryClient = useQueryClient();
  const stacks = useBoardHistory((state) => state.stacks[boardId]);

  const run = async (direction: "undo" | "redo") => {
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
      await queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) });
      await queryClient.invalidateQueries({ queryKey: ["trash"] });
    }
  };

  return {
    canUndo: (stacks?.undo.length ?? 0) > 0,
    canRedo: (stacks?.redo.length ?? 0) > 0,
    undo: () => void run("undo"),
    redo: () => void run("redo"),
  };
}
