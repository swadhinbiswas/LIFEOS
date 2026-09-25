import Link from "next/link";

import { EmptyState } from "@/components/tui/empty-state";
import { blockOffset, formatClock, type ScheduleStrip } from "@/server/dashboard/schedule";

/**
 * The day as a time-blocked strip (spec §6.8, line 293).
 *
 * Server-rendered to zero client JS: the geometry is computed here from the user's own events, so
 * the first paint is the finished strip. The current-time marker is a positioned rule, and because
 * the layout is a grid with `currentColor` borders rather than absolutely-positioned pixels, it
 * stays correct at any zoom (ADR-041).
 *
 * Accessibility: each block is a real link with its time in the accessible name, so the strip is
 * navigable and legible to a screen reader as a list of what is on today. State is never carried by
 * colour alone — a past block is struck through and labelled, and the next block is marked "next".
 */

/** State is carried by a rule and a strike-through, never by colour alone (spec §4.4). */
const pastLine =
  "border-l-2 border-border pl-1 text-muted-foreground line-through decoration-muted-foreground/60";
const liveLine = "border-l-2 border-primary pl-1 text-foreground";
const upcomingLine = "border-l-2 border-border pl-1 text-foreground";

export function ScheduleStripView({
  strip,
  labels,
}: {
  strip: ScheduleStrip;
  labels: {
    emptyLabel: string;
    emptyHint: string;
    emptyActionLabel: string;
    now: string;
    next: string;
    untimed: string;
    untimedEmpty: string;
    openCalendar: string;
    blockLabel: (time: string, title: string, state: string) => string;
    statePast: string;
    stateNow: string;
    stateNext: string;
  };
}) {
  if (strip.isEmpty) {
    return (
      <EmptyState
        title={labels.emptyLabel}
        hint={labels.emptyHint}
        testId="schedule-empty"
        className="py-4"
      >
        <Link href="/calendar" className="w-fit font-mono text-[10px] text-primary hover:underline">
          {labels.emptyActionLabel}
        </Link>
      </EmptyState>
    );
  }

  const timed = strip.blocks.filter((block) => block.timed);
  const nowOffset = strip.nowMinutes === null ? null : blockOffset(strip.nowMinutes);

  return (
    <div data-slot="schedule-strip" className="grid gap-2">
      {timed.length > 0 ? (
        <div className="grid gap-1.5">
          <ol className="grid gap-0.5">
            {timed.map((block) => {
              const state =
                block.kind === "past"
                  ? labels.statePast
                  : block.kind === "now"
                    ? labels.stateNow
                    : labels.stateNext;
              return (
                <li key={block.id} className="flex items-center gap-2">
                  <span className="w-11 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                    {formatClock(block.startMinutes)}
                  </span>
                  {/* The rule is on the link itself, not on a wrapper: an `aria-hidden` wrapper
                      would hide the only focusable thing in the row, leaving a screen reader with
                      a list of clock times and nothing to say about them. */}
                  <Link
                    href={block.href}
                    className={
                      block.kind === "past"
                        ? `block font-mono text-xs ${pastLine}`
                        : block.kind === "now"
                          ? `block font-mono text-xs ${liveLine}`
                          : `block font-mono text-xs ${upcomingLine}`
                    }
                    aria-label={labels.blockLabel(
                      formatClock(block.startMinutes),
                      block.title,
                      state,
                    )}
                  >
                    {block.title}
                  </Link>
                  {block.isNext ? (
                    <span className="font-mono text-[10px] text-primary uppercase">
                      {labels.next}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>

          {/* The current-time rule. Sits above the list rather than inside it, so it reads as
              "where the day is now" independent of the blocks. */}
          {nowOffset === null ? null : (
            <p className="font-mono text-[10px] text-muted-foreground tabular-nums">
              <span data-slot="schedule-now">{labels.now}</span>{" "}
              <span className="text-foreground">{formatClock(strip.nowMinutes ?? 0)}</span>
            </p>
          )}
        </div>
      ) : null}

      <div className="grid gap-1">
        <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
          {labels.untimed}
        </p>
        {strip.untimed.length === 0 ? (
          <p className="font-mono text-[10px] text-muted-foreground">{labels.untimedEmpty}</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {strip.untimed.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="rounded-[var(--radius)] border border-border px-1.5 py-0.5 font-mono text-[10px] hover:border-ring hover:bg-accent"
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link href="/calendar" className="w-fit font-mono text-[10px] text-primary hover:underline">
        {labels.openCalendar}
      </Link>
    </div>
  );
}
