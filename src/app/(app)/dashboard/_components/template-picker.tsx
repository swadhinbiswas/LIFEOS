"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "cn";

import { controlBoxed } from "@/components/tui/controls";
import { useState, useTransition } from "react";

import type { DashboardVariant } from "@/config/dashboard-widgets";
import { applyTemplateAction } from "@/server/dashboard/actions";

export interface TemplateOption {
  id: string;
  label: string;
  hint: string;
}

/**
 * Starter layouts (ADR-108) — a dashboard's answer to a board template.
 *
 * Applying one is a single save through the same service the per-widget controls use, so the
 * layout a template produces is exactly a layout the user could have built by hand. The currently
 * active template is marked `aria-pressed`, so the control reports state instead of only acting.
 */
export function TemplatePicker({
  variant,
  templates,
}: {
  variant: DashboardVariant;
  templates: TemplateOption[];
}) {
  const router = useRouter();
  const t = useTranslations("Pages.Dashboard");
  const [pending, startTransition] = useTransition();
  const [applied, setApplied] = useState<string | null>(null);

  if (templates.length === 0) return null;

  const apply = (templateId: string) => {
    startTransition(async () => {
      const result = await applyTemplateAction({ variant, template: templateId });
      if (result.ok) {
        setApplied(templateId);
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col gap-1.5" data-slot="template-picker">
      <p className="font-mono text-[10px] text-muted-foreground">{t("starters")}</p>
      <ul className="flex flex-wrap gap-1.5">
        {templates.map((template) => (
          <li key={template.id}>
            <button
              type="button"
              className={cn(controlBoxed, "disabled:opacity-50")}
              disabled={pending}
              aria-pressed={applied === template.id}
              data-slot="template-button"
              title={template.hint}
              onClick={() => apply(template.id)}
            >
              {template.label}
            </button>
          </li>
        ))}
      </ul>
      <p className="font-mono text-[10px] text-muted-foreground">{t("startersHint")}</p>
    </div>
  );
}
