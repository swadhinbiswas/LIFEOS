import * as React from "react";

import { cn } from "cn";

/**
 * A select in the app's language (spec §4.1, ADR-116).
 *
 * **It stays a native `<select>`, on purpose.** A custom listbox is prettier and is worse: it
 * re-implements type-ahead, the mobile wheel picker, and the platform's own announcement, and the
 * eight native selects already in this app would each need auditing. What was actually wrong with
 * them was the *chrome* — a bare borderless control that read as a browser artefact rather than part
 * of the terminal. So the fix is the frame, the affordance, and the label treatment, and the
 * behaviour is left to the platform that already gets it right.
 *
 * The `▾` is a sibling, not a background image or a pseudo-element on the control: a glyph that
 * sits outside the native control is never clipped by it, and it stays legible in forced-colours
 * mode because it is text in `currentColor`.
 */
export interface TuiSelectProps extends React.ComponentProps<"select"> {
  /** The visible field label, set in §4.1's monospace-label style. */
  label?: React.ReactNode;
  /** Hint under the control, e.g. what the cadence means. */
  hint?: React.ReactNode;
  wrapperClassName?: string;
}

export function TuiSelect({
  label,
  hint,
  className,
  wrapperClassName,
  id,
  ...props
}: TuiSelectProps) {
  // A label needs a control to point at; a generated id keeps the pairing correct without the caller
  // having to invent one per instance.
  const generated = React.useId();
  const controlId = id ?? generated;

  return (
    <div className={cn("grid w-fit gap-1", wrapperClassName)} data-slot="tui-select">
      {label === undefined ? null : (
        <label
          htmlFor={controlId}
          className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase"
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <select
          id={controlId}
          data-slot="tui-select-control"
          className={cn(
            "h-7 w-full appearance-none rounded-[var(--radius)] border border-border bg-background py-0.5 pr-6 pl-2",
            "font-mono text-[10px] text-foreground",
            "hover:border-ring",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...props}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-1.5 font-mono text-[10px] text-muted-foreground"
        >
          ▾
        </span>
      </div>
      {hint === undefined ? null : (
        <p className="font-mono text-[10px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
