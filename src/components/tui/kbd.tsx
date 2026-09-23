import * as React from "react";
import { cn } from "cn";

/**
 * A single key cap. Compose chords inline: `<Kbd>Ctrl</Kbd> + <Kbd>K</Kbd>` — the StatusLine
 * does this from its `hints` prop. Not interactive, so no touch-target requirement (spec §4.4
 * applies to controls); the border/radius follow the active theme axes.
 */
export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex min-w-[1.5rem] shrink-0 items-center justify-center rounded-sm border border-border bg-card px-1 font-mono text-[0.75em] leading-5 tabular-nums select-none",
        className,
      )}
      {...props}
    />
  );
}
