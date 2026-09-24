"use client";

import { useTranslations } from "next-intl";

import { Kbd } from "@/components/tui/kbd";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KEY_BINDINGS } from "@/config/shortcuts";

/**
 * `?` help overlay (ADR-025 / ADR-060): lists exactly the bindings in `config/shortcuts.ts`, so a
 * key that does nothing can never be advertised. Labels and group headings are translated.
 */
export function HelpOverlay({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Shortcuts");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("helpTitle")}</DialogTitle>
          <DialogDescription>{t("helpDescription")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-xs">
          {KEY_BINDINGS.map((group) => (
            <div key={group.title} className="flex flex-col gap-1">
              <h3 className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                {t(group.titleKey)}
              </h3>
              <dl className="flex flex-col gap-1">
                {group.hints.map((binding) => (
                  <div key={binding.label} className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">
                      {binding.key ? t(binding.key) : binding.label}
                    </dt>
                    <dd className="flex items-center gap-1">
                      {binding.keys.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
