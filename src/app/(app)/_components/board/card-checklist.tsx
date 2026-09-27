"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AsciiMeter } from "@/components/tui/ascii-meter";
import { Button } from "@/components/ui/button";
import {
  addChecklistItemAction,
  listCardChecklistAction,
  removeChecklistItemAction,
  setChecklistItemDoneAction,
} from "@/server/boards/actions";

import { boardQueryKey } from "./use-board";

const checklistKey = (cardId: string) => ["card-checklist", cardId] as const;

/**
 * Subtasks for the open card (spec §6.1).
 *
 * The item text is the checkbox's label, so nothing is announced twice and there is no aria string
 * to translate. The checkbox clears the 24px target floor on its own (WCAG 2.2 SC 2.5.8) rather
 * than relying on the label around it, because the guard measures the input.
 *
 * Writes return the whole checklist and the board query is invalidated with it: the card face draws
 * the same progress, and a `3/5` that only updates on reload is worse than no progress at all.
 */
export function CardChecklist({ cardId, boardId }: { cardId: string; boardId: string }) {
  const queryClient = useQueryClient();
  const t = useTranslations("Pages.Board");
  const [draft, setDraft] = useState("");
  /**
   * Ticks applied locally while the write is in flight. A controlled checkbox that waits for a
   * round trip to *appear* ticked reads as broken — a checkbox is the one control with no latency
   * budget — so the box flips on click and the server's answer, which carries the whole checklist,
   * replaces this state in the same render.
   */
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const checklist = useQuery({
    queryKey: checklistKey(cardId),
    queryFn: async () => {
      const result = await listCardChecklistAction({ cardId });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });

  const clearPending = (itemId: string) =>
    setPending((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });

  /** The card face draws the same progress, so the board query is refreshed with every write. */
  const refreshCardFace = () =>
    void queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) });

  const add = useMutation({
    mutationFn: async (text: string) => {
      const result = await addChecklistItemAction({ cardId, text });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (data) => {
      setDraft("");
      queryClient.setQueryData(checklistKey(cardId), data);
      refreshCardFace();
    },
  });

  const toggle = useMutation({
    mutationFn: async (vars: { itemId: string; done: boolean }) => {
      const result = await setChecklistItemDoneAction(vars);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (data, vars) => {
      queryClient.setQueryData(checklistKey(cardId), data);
      clearPending(vars.itemId);
      refreshCardFace();
    },
    // A failed write drops the optimistic tick, so the box reverting is the visible signal.
    onError: (_error, vars) => clearPending(vars.itemId),
  });

  const remove = useMutation({
    mutationFn: async (itemId: string) => {
      const result = await removeChecklistItemAction({ itemId });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(checklistKey(cardId), data);
      refreshCardFace();
    },
  });

  const items = checklist.data?.items ?? [];
  const isDone = (item: (typeof items)[number]) => pending[item.id] ?? item.done_at !== null;
  const done = items.filter(isDone).length;
  const total = items.length;

  return (
    <div className="flex flex-col gap-1" data-slot="card-checklist">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">{t("checklist")}</span>
        {total > 0 ? (
          <span className="flex items-center gap-2">
            <AsciiMeter
              value={done / total}
              label={t("checklistProgress", { done, total })}
              cells={6}
              showValue={false}
              className="text-[10px]"
            />
            <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
              {t("checklistProgress", { done, total })}
            </span>
          </span>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="font-mono text-[10px] text-muted-foreground">{t("checklistEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2" data-slot="checklist-item">
              <label className="flex min-w-0 flex-1 items-center gap-2 font-mono text-xs">
                <input
                  type="checkbox"
                  checked={isDone(item)}
                  onChange={(event) => {
                    setPending((current) => ({ ...current, [item.id]: event.target.checked }));
                    toggle.mutate({ itemId: item.id, done: event.target.checked });
                  }}
                  className="h-6 w-6 shrink-0"
                />
                <span
                  className={
                    isDone(item) ? "truncate text-muted-foreground line-through" : "truncate"
                  }
                >
                  {item.text}
                </span>
              </label>
              <button
                type="button"
                aria-label={t("removeChecklistItem", { text: item.text })}
                onClick={() => remove.mutate(item.id)}
                className="min-h-6 min-w-6 shrink-0 font-mono text-[10px] text-muted-foreground hover:text-destructive"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        method="post"
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim() === "") return;
          add.mutate(draft.trim());
        }}
      >
        <label className="sr-only" htmlFor="card-checklist-input">
          {t("checklistPlaceholder")}
        </label>
        <input
          id="card-checklist-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("checklistPlaceholder")}
          className="h-7 min-w-0 flex-1 border border-border bg-background px-2 font-mono text-xs"
        />
        <Button type="submit" variant="outline" size="sm" disabled={add.isPending || !draft.trim()}>
          {t("addChecklistItem")}
        </Button>
      </form>
    </div>
  );
}
