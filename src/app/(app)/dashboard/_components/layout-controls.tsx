"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "cn";

import { TuiCheckbox } from "@/components/tui/checkbox";
import { controlBoxed } from "@/components/tui/controls";
import { useState } from "react";

import type { LayoutInput } from "@/config/dashboard-widgets";
import { saveLayoutAction } from "@/server/dashboard/actions";

/**
 * Widget visibility and order (ADR-046). Reordering uses explicit buttons rather than drag: the
 * keyboard path is then identical to the pointer path (the ADR-016 rule applied to widgets), and
 * the whole layout is saved in one atomic action.
 */
export function LayoutControls({
  layout,
  labels,
}: {
  layout: LayoutInput;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const t = useTranslations("Pages.Dashboard");
  const [widgets, setWidgets] = useState(layout.widgets);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const persist = async (next: typeof widgets) => {
    setWidgets(next);
    setBusy(true);
    const result = await saveLayoutAction({ variant: layout.variant, widgets: next });
    setBusy(false);
    if (result.ok) {
      setSaved(true);
      router.refresh();
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= widgets.length) return;
    const next = [...widgets];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    void persist(next.map((widget, position) => ({ ...widget, position })));
  };

  return (
    <div className="flex flex-col gap-1" data-slot="layout-controls">
      <p className="font-mono text-[10px] text-muted-foreground">{t("layoutHint")}</p>
      <ul className="flex flex-col gap-1">
        {widgets.map((widget, index) => (
          <li key={widget.id} className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <TuiCheckbox
              checked={widget.visible}
              // Restored deliberately: the label says what the control *does* ("show habit
              // pulse"), which is a better name than the bare widget label, and the visible text
              // is still contained in it so WCAG's label-in-name holds.
              aria-label={t("show", { name: labels[widget.id] ?? widget.id })}
              onCheckedChange={(visible) =>
                void persist(
                  widgets.map((entry) => (entry.id === widget.id ? { ...entry, visible } : entry)),
                )
              }
              disabled={busy}
              className="min-w-48 normal-case"
            >
              {labels[widget.id] ?? widget.id}
            </TuiCheckbox>
            <button
              type="button"
              className={cn(controlBoxed, "min-w-7 px-1")}
              disabled={busy || index === 0}
              onClick={() => move(index, -1)}
              aria-label={t("moveUp", { name: labels[widget.id] ?? widget.id })}
            >
              ↑
            </button>
            <button
              type="button"
              className={cn(controlBoxed, "min-w-7 px-1")}
              disabled={busy || index === widgets.length - 1}
              onClick={() => move(index, 1)}
              aria-label={t("moveDown", { name: labels[widget.id] ?? widget.id })}
            >
              ↓
            </button>
          </li>
        ))}
      </ul>
      {saved ? (
        <p role="status" className="font-mono text-[10px] text-muted-foreground">
          {t("layoutSaved")}
        </p>
      ) : null}
    </div>
  );
}
