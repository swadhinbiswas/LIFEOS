"use client";

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
        <div className="flex flex-col gap-3 text-xs">
          {KEY_BINDINGS.map((group) => (
            <div key={group.title} className="flex flex-col gap-1">
              <h3 className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                {group.title}
              </h3>
              <dl className="flex flex-col gap-1">
                {group.hints.map((binding) => (
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
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
