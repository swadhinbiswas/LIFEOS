import * as React from "react";

import { cn } from "cn";

/**
 * The empty state (spec §3.3 states): a short sentence and what to do next, never a blank area and
 * never lorem ipsum. The dashed frame reads as "nothing here yet" without shouting.
 */
export function EmptyState({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  /** An action, e.g. a link to create the first item. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-start gap-1 rounded-[var(--radius)] border border-dashed border-border px-3 py-4",
        className,
      )}
    >
      <p className="font-mono text-xs">{title}</p>
      {hint ? <p className="font-mono text-[10px] text-muted-foreground">{hint}</p> : null}
      {children}
    </div>
  );
}
