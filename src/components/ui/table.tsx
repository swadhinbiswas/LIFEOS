"use client";

import * as React from "react";
import { cn } from "cn";

function Table({
  className,
  containerClassName,
  scrollRegion,
  ...props
}: React.ComponentProps<"table"> & {
  containerClassName?: string;
  /**
   * Names the scrollable region, and makes it focusable. A horizontally scrolling `div` that cannot
   * take focus is not keyboard-operable (WCAG 2.1.1) — the arrow keys do nothing because nothing is
   * focused — so passing a label here is what opts a wide table into keyboard scrolling. The role
   * and the `tabindex` go together deliberately: either alone is worse than neither.
   */
  scrollRegion?: string;
}) {
  return (
    // `scrollbar-hidden`: a wide table used to draw the OS scrollbar, which is a light widget with
    // arrow buttons sitting in a dark interface — the loudest thing on the page and information the
    // reader does not need, because the table overflows by a little. The region still scrolls; only
    // the bar is gone. The board's own scroller keeps its bar, which is a real affordance there.
    //
    // Hiding the bar is only honest while the overflow is small. A table with eleven columns
    // overflows by a couple of hundred pixels, and with no bar and no drag the reader concludes the
    // last columns do not exist. A wide table therefore passes `scroll-x-tui` (a themed, visible
    // bar) instead, and `scroll-shadow-x` for the edge.
    <div
      data-slot="table-container"
      className={cn(
        "relative w-full overflow-x-auto",
        scrollRegion ? "scroll-tui" : "scrollbar-hidden",
        containerClassName,
      )}
      {...(scrollRegion ? { role: "region", "aria-label": scrollRegion, tabIndex: 0 } : {})}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0", className)}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
