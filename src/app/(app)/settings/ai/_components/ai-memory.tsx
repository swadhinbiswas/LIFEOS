"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { addMemoryAction, deleteMemoryAction, updateMemoryAction } from "@/server/ai/actions";
import type { MemoryItem } from "@/server/ai/memory";

/**
 * Memory items (spec §8): every durable fact is visible, editable and deletable here, and the
 * context builder only sends them when the memory preference is on. Nothing is remembered silently.
 */
export function AiMemory({ items }: { items: MemoryItem[] }) {
  const router = useRouter();
  const t = useTranslations("Pages.AiSettings");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (call: () => Promise<{ ok: boolean }>) => {
    setBusy(true);
    const result = await call();
    setBusy(false);
    if (result.ok) router.refresh();
  };

  return (
    <div className="flex flex-col gap-3" data-slot="ai-memory">
      <span className="font-mono text-[10px] text-muted-foreground uppercase">
        {t("memoryTitle")}
      </span>

      {items.length === 0 ? (
        <p className="font-mono text-xs text-muted-foreground">{t("memoryEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li
              key={item.id}
              data-slot="ai-memory-row"
              className="flex flex-wrap items-center gap-2 border border-border px-2 py-1 font-mono text-xs"
            >
              {editing === item.id ? (
                <>
                  <input
                    value={editValue}
                    onChange={(event) => setEditValue(event.target.value)}
                    className="min-w-0 flex-1 border border-border bg-background px-1 py-0.5 font-mono text-xs outline-none"
                    aria-label={t("memoryPlaceholder")}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy || editValue.trim() === ""}
                    onClick={() =>
                      void run(() =>
                        updateMemoryAction({ id: item.id, content: editValue.trim() }),
                      ).then(() => setEditing(null))
                    }
                  >
                    {t("savePreferences")}
                  </Button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1">{item.content}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setEditing(item.id);
                      setEditValue(item.content);
                    }}
                  >
                    {t("edit")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    aria-label={t("memoryDeleteAria")}
                    onClick={() => void run(() => deleteMemoryAction({ id: item.id }))}
                  >
                    {t("memoryDelete")}
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="ai-memory-input">
          {t("memoryPlaceholder")}
        </label>
        <input
          id="ai-memory-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("memoryPlaceholder")}
          className="min-w-0 flex-1 border border-border bg-background px-2 py-1 font-mono text-xs outline-none placeholder:text-muted-foreground"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || draft.trim() === ""}
          onClick={() =>
            void run(() => addMemoryAction({ content: draft.trim() })).then(() => setDraft(""))
          }
        >
          {t("memoryAdd")}
        </Button>
      </div>
    </div>
  );
}
