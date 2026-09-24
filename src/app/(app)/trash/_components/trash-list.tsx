"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { TrashItem } from "@/server/trash";
import {
  purgeExpiredTrashAction,
  purgeTrashItemAction,
  restoreTrashItemAction,
} from "@/server/trash/actions";

/**
 * The trash list (spec §6.9, ADR-048). Restore and "delete forever" both go through the module
 * that owns the row; "delete forever" is only ever offered for a row already trashed.
 */
export function TrashList({ items }: { items: TrashItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const act = async (run: () => Promise<{ ok: boolean }>) => {
    setBusy(true);
    await run();
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li
            key={`${item.kind}:${item.id}`}
            data-slot="trash-row"
            data-kind={item.kind}
            className="flex flex-wrap items-center gap-2 border border-border px-2 py-1 font-mono text-xs"
          >
            <span className="text-primary">{item.kind}</span>
            <span className="min-w-0 flex-1 truncate">{item.title}</span>
            {item.context ? <span className="text-muted-foreground">{item.context}</span> : null}
            <time dateTime={item.deletedAt} className="text-muted-foreground tabular-nums">
              {item.deletedAt.slice(0, 10)}
            </time>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              aria-label={`restore ${item.title}`}
              onClick={() =>
                void act(() => restoreTrashItemAction({ kind: item.kind, id: item.id }))
              }
            >
              restore
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              aria-label={`delete ${item.title} forever`}
              onClick={() => void act(() => purgeTrashItemAction({ kind: item.kind, id: item.id }))}
            >
              delete forever
            </Button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          data-slot="purge-expired"
          onClick={() => void act(() => purgeExpiredTrashAction())}
        >
          purge older than 30 days
        </Button>
        <p className="font-mono text-[10px] text-muted-foreground">
          restoring a note re-indexes it and brings its backlinks back
        </p>
      </div>
    </div>
  );
}
