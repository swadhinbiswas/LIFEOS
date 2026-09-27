"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  cardLabelsAction,
  createBoardLabelAction,
  setCardLabelsAction,
} from "@/server/boards/actions";

import { LABEL_COLORS, labelChip, type LabelColor } from "./label-tone";
import { boardQueryKey } from "./use-board";

const labelsKey = (cardId: string) => ["card-labels", cardId] as const;

/**
 * Label editor for the open card (spec §6.1).
 *
 * The whole selection is sent on every change — the editor holds it, so the call is idempotent and
 * a double-click cannot duplicate an attach or drop one. Ticks are applied locally first for the
 * same reason the checklist checkbox is optimistic: a chip that only lights up after a round trip
 * feels broken.
 *
 * Creating a label attaches it in the same action chain, because a label you just named but did not
 * apply is a label you have to find again. Board-wide rename and delete are deliberately absent —
 * both are destructive to every card that carries the label, and this app has no blocking-confirm
 * pattern to put in front of them yet.
 */
export function CardLabels({ cardId, boardId }: { cardId: string; boardId: string }) {
  const queryClient = useQueryClient();
  const t = useTranslations("Pages.Board");
  const [draft, setDraft] = useState("");
  const [color, setColor] = useState<LabelColor>("info");
  /** Locally applied selection while a write is in flight; `null` = whatever the server said. */
  const [optimistic, setOptimistic] = useState<string[] | null>(null);

  const labels = useQuery({
    queryKey: labelsKey(cardId),
    queryFn: async () => {
      const result = await cardLabelsAction({ cardId });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });

  const available = labels.data?.available ?? [];
  const selected = optimistic ?? labels.data?.selected ?? [];

  const cache = (data: { available: unknown[]; selected: string[] }) => {
    queryClient.setQueryData(labelsKey(cardId), data);
    setOptimistic(null);
    void queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) });
  };

  const save = useMutation({
    mutationFn: async (labelIds: string[]) => {
      const result = await setCardLabelsAction({ cardId, labelIds });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: cache,
    onError: () => setOptimistic(null),
  });

  const create = useMutation({
    mutationFn: async (name: string) => {
      const created = await createBoardLabelAction({ boardId, name, color });
      if (!created.ok) throw new Error(created.message);
      const saved = await setCardLabelsAction({
        cardId,
        labelIds: [...selected, created.data.id],
      });
      if (!saved.ok) throw new Error(saved.message);
      return saved.data;
    },
    onSuccess: (data) => {
      setDraft("");
      cache(data);
    },
  });

  const toggle = (labelId: string) => {
    const next = selected.includes(labelId)
      ? selected.filter((id) => id !== labelId)
      : [...selected, labelId];
    setOptimistic(next);
    save.mutate(next);
  };

  return (
    <div className="flex flex-col gap-1" data-slot="card-labels">
      <span className="font-mono text-xs text-muted-foreground">{t("labels")}</span>

      {available.length === 0 ? (
        <p className="font-mono text-[10px] text-muted-foreground">{t("noLabels")}</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {available.map((label) => {
            const on = selected.includes(label.id);
            return (
              <button
                key={label.id}
                type="button"
                data-slot="label-chip"
                data-label-name={label.name}
                aria-pressed={on}
                aria-label={t("toggleLabel", { name: label.name })}
                onClick={() => toggle(label.id)}
                className={labelChip(
                  label.color,
                  on ? "" : "opacity-50 hover:opacity-100 focus-visible:opacity-100",
                )}
              >
                {label.name}
              </button>
            );
          })}
        </div>
      )}

      <form
        method="post"
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim() === "") return;
          create.mutate(draft.trim());
        }}
      >
        <label className="sr-only" htmlFor="card-label-input">
          {t("newLabel")}
        </label>
        <input
          id="card-label-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("newLabel")}
          className="h-7 min-w-0 flex-1 border border-border bg-background px-2 font-mono text-xs"
        />
        <label className="sr-only" htmlFor="card-label-color">
          {t("labelColor")}
        </label>
        <select
          id="card-label-color"
          value={color}
          onChange={(event) => setColor(event.target.value as LabelColor)}
          className="h-7 border border-border bg-background px-1 font-mono text-[10px]"
        >
          {LABEL_COLORS.map((tone) => (
            <option key={tone} value={tone}>
              {t(`labelColors.${tone}`)}
            </option>
          ))}
        </select>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={create.isPending || !draft.trim()}
        >
          {t("addLabel")}
        </Button>
      </form>
    </div>
  );
}
