"use client";

import * as React from "react";

import { cn } from "cn";

/**
 * A checkbox in the app's own language (spec §4.1, ADR-116).
 *
 * A shadcn checkbox is a Radix rounded square, which belongs to a different design system than the
 * one in this repo — and §4.1 is explicit that state is carried by small Unicode glyphs (`● ○ ◐ ✓
 * ✗ ▸ ⚑`) next to monospace labels. So this is a TUI primitive, not a substitute for a shadcn one.
 *
 * It is a real `<button role="checkbox" aria-checked>` rather than a hidden native input:
 * - **Keyboard**: focusable and toggled with Space or Enter for free, with no `onKeyDown` to get
 *   subtly wrong.
 * - **Announced**: a native checkbox would be, and this carries the same role and state, so a screen
 *   reader says "checked" rather than nothing.
 * - **Touch**: the hit area clears the 28 px floor §4.4 sets for controls, which a bare 12 px glyph
 *   would not. The earlier native checkboxes on this page were roughly that small.
 * - **Forced colours**: the glyph is text in `currentColor`, so Windows High Contrast renders it
 *   without a single custom property.
 */
export interface TuiCheckboxProps extends Omit<
  React.ComponentProps<"button">,
  "onChange" | "value" | "type"
> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** The visible label. Omit it only for a checkbox whose state is already stated in prose. */
  children?: React.ReactNode;
}

/** `▣` filled, `☐` empty — both exist in the same monospace cell, so the box never shifts width. */
const GLYPH = { on: "▣", off: "☐" } as const;

export function TuiCheckbox({
  checked,
  onCheckedChange,
  className,
  children,
  ...props
}: TuiCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      data-slot="tui-checkbox"
      data-state={checked ? "checked" : "unchecked"}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "group inline-flex min-h-7 items-center gap-2 rounded-[var(--radius)] px-1 py-0.5 text-left",
        "font-mono text-[10px] tracking-wider uppercase",
        // The ring is never removed: spec §4.1 requires a visible focus ring for keyboard users.
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "hover:bg-accent/60",
        checked ? "text-foreground" : "text-muted-foreground",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-4 shrink-0 place-items-center text-xs leading-none transition-colors",
          checked ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
        )}
      >
        {checked ? GLYPH.on : GLYPH.off}
      </span>
      {children === undefined ? (
        <span className="sr-only">{checked ? "checked" : "unchecked"}</span>
      ) : (
        <span className="min-w-0">{children}</span>
      )}
    </button>
  );
}
