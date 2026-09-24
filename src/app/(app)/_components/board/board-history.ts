"use client";

import { create } from "zustand";

import type { UpdateCardVars } from "./use-board";

/**
 * The board's undo/redo stacks (spec §6.1: "the last 50 board actions"), kept **outside React
 * and outside the query cache**.
 *
 * The first attempt held the stacks in refs inside the board hook and replayed entries through
 * the optimistic mutations; that recursed (an undo recorded a new undo), raced with settle
 * refetches and made two e2e specs flaky. Here the store only remembers *intent*; the caller
 * applies it through the version-free reversal actions, so there is nothing to suppress and no
 * client-held version to go stale.
 */

export interface UndoLocation {
  columnId: string;
  prevCardId: string | null;
  nextCardId: string | null;
}

export type HistoryEntry =
  | { kind: "move"; cardId: string; from: UndoLocation; to: UndoLocation }
  | { kind: "create"; cardId: string }
  | { kind: "remove"; cardId: string }
  | {
      kind: "update";
      cardId: string;
      before: Partial<UpdateCardVars>;
      after: Partial<UpdateCardVars>;
    };

const LIMIT = 50;

interface Stacks {
  undo: HistoryEntry[];
  redo: HistoryEntry[];
}

interface HistoryState {
  stacks: Record<string, Stacks>;
  record: (boardId: string, entry: HistoryEntry) => void;
  /** Pops the entry to apply; the caller pushes it back with `settle`. */
  take: (boardId: string, direction: "undo" | "redo") => HistoryEntry | undefined;
  settle: (boardId: string, direction: "undo" | "redo", entry: HistoryEntry) => void;
}

const empty: Stacks = { undo: [], redo: [] };

export const useBoardHistory = create<HistoryState>()((set, get) => ({
  stacks: {},

  record: (boardId, entry) =>
    set((state) => {
      const current = state.stacks[boardId] ?? empty;
      return {
        stacks: {
          ...state.stacks,
          [boardId]: { undo: [...current.undo, entry].slice(-LIMIT), redo: [] },
        },
      };
    }),

  take: (boardId, direction) => {
    const current = get().stacks[boardId] ?? empty;
    const entry = current[direction].at(-1);
    if (!entry) return undefined;
    set((state) => ({
      stacks: {
        ...state.stacks,
        [boardId]: { ...current, [direction]: current[direction].slice(0, -1) },
      },
    }));
    return entry;
  },

  settle: (boardId, direction, entry) => {
    const other = direction === "undo" ? "redo" : "undo";
    set((state) => {
      const current = state.stacks[boardId] ?? empty;
      return {
        stacks: {
          ...state.stacks,
          [boardId]: {
            ...current,
            [other]: [...current[other], entry].slice(-LIMIT),
          },
        },
      };
    });
  },
}));
