"use client";

import { Kbd } from "@/components/tui/kbd";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HELP_BINDINGS } from "@/config/shortcuts";

/**
 * `?` help overlay (ADR-025): lists exactly the bindings in `config/shortcuts.ts`, so a key
 * that does nothing can never be advertised.
 */
export function HelpOverlay({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard</DialogTitle>
          <DialogDescription>Active bindings in this build.</DialogDescription>
        </DialogHeader>
        <dl className="flex flex-col gap-2 text-xs">
          {HELP_BINDINGS.map((binding) => (
            <div key={binding.label} className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{binding.label}</dt>
              <dd className="flex items-center gap-1">
                {binding.keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
