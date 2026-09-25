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
  testId,
}: {
  title: string;
  hint?: string;
  /** An action, e.g. a link to create the first item. */
  children?: React.ReactNode;
  className?: string;
  /**
   * A `data-testid` for the case where several empty states are on one screen and a test needs to
   * name which one it means. Preferred over a new test-only slot: the visible `data-slot` is shared
   * by every empty state in the app, so it cannot distinguish them.
   */
  testId?: string;
}) {
  return (
    <div
      data-slot="empty-state"
      data-testid={testId}
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
