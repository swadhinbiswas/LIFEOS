import * as React from "react";

import { cn } from "cn";

/**
 * The page header every screen uses (spec §3.3 anatomy): the page name, an optional count, and a
 * right-aligned toolbar slot (view switches, filters, the primary action). Keeping it in one place
 * is what makes the pages look like one product instead of fourteen.
 */
export function PageHeader({
  title,
  count,
  countLabel,
  children,
  className,
}: {
  title: string;
  /** A number rendered next to the title (the reference shows "All People · 121"). */
  count?: number;
  /** Optional word after the count, e.g. "cards". */
  countLabel?: string;
  /** Toolbar: view switches, filters, primary action. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="page-header"
      className={cn(
        "mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border pb-3",
        className,
      )}
    >
      <h1 className="font-mono text-sm font-semibold tracking-wider uppercase">{title}</h1>
      {count !== undefined ? (
        <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
          · {count}
          {countLabel ? ` ${countLabel}` : ""}
        </span>
      ) : null}
      {children ? (
        <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}
