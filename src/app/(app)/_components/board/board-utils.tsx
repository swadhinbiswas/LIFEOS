"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Panel } from "@/components/tui/panel";
import type { Card } from "@/server/boards";
import {
  listTrashAction,
  purgeCardAction,
  purgeTrashAction,
  restoreCardAction,
} from "@/server/boards/actions";

import { boardQueryKey } from "./use-board";

/** Plain-token control (ADR-041): opacity modifiers make axe sample pixels. */
const control =
  "rounded-[var(--radius)] border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-foreground hover:bg-accent hover:text-accent-foreground";

/**
 * Board utilities (spec §6.1): CSV/JSON export and the 30-day Trash. Restoring is the same
 * service write as everything else; "delete forever" is only offered for rows that are already
 * trashed, so a mis-click cannot destroy live work.
 */
export function BoardUtils({ boardId }: { boardId: string }) {
  const queryClient = useQueryClient();
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
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1 font-mono text-[10px] text-muted-foreground">
        <span>export</span>
        {/* Real links: these are downloads, so a router navigation would be wrong. */}
        <a
          className={control}
          href={`/api/boards/${boardId}/export?format=csv`}
          download={`${boardId}.csv`}
        >
          csv
        </a>
        <a
          className={control}
          href={`/api/boards/${boardId}/export?format=json`}
          download={`${boardId}.json`}
        >
          json
        </a>
        <button
          type="button"
          className={control}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          trash ({items.length})
        </button>
      </div>

      {open ? (
        <Panel title="Trash" hint={`${items.length}`}>
          {items.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">trash is empty</p>
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
                    className={control}
                    onClick={() => restore.mutate(card.id)}
                    aria-label={`restore ${card.title}`}
                  >
                    restore
                  </button>
                  <button
                    type="button"
                    className={control}
                    onClick={() => purgeOne.mutate(card.id)}
                    aria-label={`delete ${card.title} forever`}
                  >
                    delete forever
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={control}
              disabled={purgeOld.isPending}
              onClick={() => purgeOld.mutate()}
            >
              purge older than 30 days
            </button>
            <p className="font-mono text-[10px] text-muted-foreground">
              trashed cards keep their place and restore without a rewrite
            </p>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
