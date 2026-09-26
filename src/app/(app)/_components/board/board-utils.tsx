"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { cn } from "cn";

import { Panel } from "@/components/tui/panel";
import type { Card } from "@/server/boards";
import {
  listTrashAction,
  purgeCardAction,
  purgeTrashAction,
  restoreCardAction,
} from "@/server/boards/actions";

import { controlBoxed, controlGhost, ToolbarGroup } from "./controls";
import { boardQueryKey } from "./use-board";

/**
 * Board utilities (spec §6.1): CSV/JSON export and the 30-day Trash. Restoring is the same
 * service write as everything else; "delete forever" is only offered for rows that are already
 * trashed, so a mis-click cannot destroy live work.
 */
export function BoardUtils({ boardId }: { boardId: string }) {
  const queryClient = useQueryClient();
  const t = useTranslations("Pages.Board");
  const [open, setOpen] = useState(false);
  const trashKey = ["trash", boardId] as const;

  const trash = useQuery({
    queryKey: trashKey,
    queryFn: async () => {
      const result = await listTrashAction({ boardId });
      if (!result.ok) throw new Error(result.message);
      return result.data as Card[];
    },
  });

  const afterChange = () => {
    void queryClient.invalidateQueries({ queryKey: trashKey });
    void queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) });
  };

  const restore = useMutation({
    mutationFn: async (cardId: string) => {
      const result = await restoreCardAction({ cardId });
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: afterChange,
  });

  const purgeOne = useMutation({
    mutationFn: async (cardId: string) => {
      const result = await purgeCardAction({ cardId });
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: afterChange,
  });

  const purgeOld = useMutation({
    mutationFn: async () => {
      const result = await purgeTrashAction();
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: afterChange,
  });

  const items = trash.data ?? [];

  return (
    <>
      <ToolbarGroup ruled>
        <span className="font-mono text-[10px] text-muted-foreground">{t("export")}</span>
        {/* Real links: these are downloads, so a router navigation would be wrong. */}
        <a
          className={controlGhost}
          href={`/api/boards/${boardId}/export?format=csv`}
          download={`${boardId}.csv`}
        >
          {t("csv")}
        </a>
        <a
          className={controlGhost}
          href={`/api/boards/${boardId}/export?format=json`}
          download={`${boardId}.json`}
        >
          {t("json")}
        </a>
        <button
          type="button"
          className={controlGhost}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {t("trashButton", { count: items.length })}
        </button>
      </ToolbarGroup>

      {open ? (
        <Panel title={t("trashTitle")} hint={`${items.length}`}>
          {items.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">{t("trashEmpty")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {items.map((card) => (
                <li
                  key={card.id}
                  data-slot="trash-card"
                  data-card-id={card.id}
                  className="flex flex-wrap items-center gap-2 border border-border px-2 py-1"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{card.title}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {card.deleted_at ? new Date(card.deleted_at).toISOString().slice(0, 10) : ""}
                  </span>
                  <button
                    type="button"
                    className={controlBoxed}
                    onClick={() => restore.mutate(card.id)}
                    aria-label={t("restoreAria", { title: card.title })}
                  >
                    {t("restore")}
                  </button>
                  <button
                    type="button"
                    className={cn(
                      controlBoxed,
                      "hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive",
                    )}
                    onClick={() => purgeOne.mutate(card.id)}
                    aria-label={t("deleteForeverAria", { title: card.title })}
                  >
                    {t("deleteForever")}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={cn(
                controlGhost,
                "border border-border text-foreground hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive",
              )}
              disabled={purgeOld.isPending}
              onClick={() => purgeOld.mutate()}
            >
              {t("purge")}
            </button>
            <p className="font-mono text-[10px] text-muted-foreground">{t("trashKeep")}</p>
          </div>
        </Panel>
      ) : null}
    </>
  );
}
