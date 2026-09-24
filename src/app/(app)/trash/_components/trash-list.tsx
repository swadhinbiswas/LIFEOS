"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("Pages.Trash");
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
              aria-label={t("restoreAria", { title: item.title })}
              onClick={() =>
                void act(() => restoreTrashItemAction({ kind: item.kind, id: item.id }))
              }
            >
              {t("restore")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              aria-label={t("deleteForeverAria", { title: item.title })}
              onClick={() => void act(() => purgeTrashItemAction({ kind: item.kind, id: item.id }))}
            >
              {t("deleteForever")}
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
          {t("purge")}
        </Button>
        <p className="font-mono text-[10px] text-muted-foreground">{t("restoreHint")}</p>
      </div>
    </div>
  );
}
