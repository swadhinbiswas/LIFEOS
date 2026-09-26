import type * as React from "react";

import { cn } from "cn";

/**
 * The board's control vocabulary (spec §4.1, ADR-117).
 *
 * There are two tiers and the difference is the whole point. `/tasks` used to draw twenty bordered
 * controls in three stacked rows above eight cards, every one of them the same weight as every
 * other, and the result was tiring to read before any work appeared. The fix is not less contrast —
 * the palette is already at 11:1 and passes — it is less ink for the things you rarely touch.
 *
 * - {@link controlGhost} is the default for anything occasional: saved views, undo/redo, export,
 *   trash. Muted text, no border, and the border plus a background arrive on hover and focus.
 * - {@link controlChip} is the persistent tier: the view switch and the search field keep their
 *   chrome, because they are used constantly and a borderless control that is always on screen reads
 *   as a label rather than a control.
 * - {@link chipState} decides the two states of a toggle chip, so "off" stops being a box.
 *
 * Both hover *and* `focus-visible` raise the border. A control that only reveals itself on hover is
 * unusable with a keyboard and invisible on touch, and this app is keyboard-first (spec §4.4).
 */
export const controlGhost = cn(
  // `border border-transparent` rather than no border at all. The border's *width* is reserved from
  // the start, so hovering changes the ink and nothing else: with `hover:border` on a borderless
  // element the box grew by 2px and nudged every sibling to its right, which is exactly the sort of
  // small instability that makes a dense toolbar feel restless. Transparent is invisible, so the
  // control is still borderless in every sense a reader can see.
  "rounded-[var(--radius)] border border-transparent px-2 py-0.5 font-mono text-[10px]",
  "text-muted-foreground",
  "hover:border-border hover:bg-background hover:text-foreground",
  "focus-visible:border-ring focus-visible:bg-background focus-visible:text-foreground",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  "disabled:hover:border-transparent disabled:hover:bg-transparent disabled:text-muted-foreground",
);

/**
 * A toggle chip's two states.
 *
 * Off is deliberately *not* a box: five always-on bordered chips for filters that are mostly off is
 * the loudest thing on a board page and says the least. On keeps the `primary` fill, so the state
 * still reads from a colour rather than from the border's presence.
 */
export const chipState = (active: boolean) =>
  cn(
    "rounded-[var(--radius)] px-2 py-0.5 font-mono text-[10px]",
    active
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-accent hover:text-foreground",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  );

/** The persistent tier: a control that stays boxed because it is in constant use. */
export const controlBoxed = cn(
  "rounded-[var(--radius)] border border-border bg-background px-2 py-0.5 font-mono text-[10px]",
  "text-foreground",
  "hover:border-ring",
  "focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
);

/**
 * A group of related controls inside a toolbar, optionally divided from the group before it.
 *
 * The divider started as a `│` text span between groups, which looked right until the bar was
 * screenshotted at 1000 px and wrapped: the pipe was left dangling at the end of a line with its
 * group on the next one, which reads as a rendering bug rather than a division. A rule drawn as a
 * left border *on the group* travels with the group, so wrapping moves the division and the thing
 * it divides together. There is no state in which a rule can be separated from its group.
 *
 * A border is also decoration in the strict sense — it generates no box and no text, so assistive
 * tech never encounters it. That is the reason to prefer it over a glyph here, not a matter of
 * taste: a screen reader hears "views, saved views" rather than "views, vertical bar, saved views".
 */
export function ToolbarGroup({
  ruled = false,
  className,
  children,
}: {
  /** Draw the hairline that separates this group from the one before it. */
  ruled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-slot="toolbar-group"
      className={cn(
        "flex flex-wrap items-center gap-x-1 gap-y-1",
        ruled && "border-l border-border pl-2",
        className,
      )}
    >
      {children}
    </div>
  );
}
