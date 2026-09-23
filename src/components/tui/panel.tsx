import * as React from "react";
import { cn } from "cn";

type PanelHeadingLevel = "h1" | "h2" | "h3" | "h4";

export interface PanelProps extends React.ComponentProps<"div"> {
  /** Inline frame title, e.g. "Today" → the chip that breaks the top border (spec §4.1). */
  title?: string;
  /** Heading level of the title chip; panels are section labels, so h2 by default. */
  titleAs?: PanelHeadingLevel;
  /** Right frame chip for counts/state, e.g. "5 of 20" (lazygit list footer, RESEARCH §c). */
  hint?: string;
  /**
   * Border switches to the ring token — focus communicated by border color alone
   * (RESEARCH §c decisions #1/#6: three-tier border tokens, active border brighter).
   */
  active?: boolean;
}

/**
 * The frame every LifeOS card uses: a 1 px hairline box whose top border is broken by a
 * title chip (fieldset-legend style). The frame is CSS — no box-drawing characters are
 * printed anywhere (spec §4.1), so it stays crisp at any zoom and the heading stays a
 * real heading for assistive tech.
 */
export function Panel({
  title,
  titleAs: Heading = "h2",
  hint,
  active,
  className,
  children,
  ...props
}: PanelProps) {
  const hasFrameLabels = title !== undefined || hint !== undefined;
  return (
    <div
      data-slot="panel"
      className={cn(
        "relative flex min-w-0 flex-col rounded-[var(--radius)] border border-border bg-card",
        active && "border-ring",
        className,
      )}
      {...props}
    >
      {title !== undefined ? (
        <Heading className="absolute top-0 left-3 z-10 max-w-[55%] -translate-y-1/2 truncate rounded-[var(--radius)] bg-card px-2 font-mono text-xs font-medium tracking-wider uppercase select-none">
          {title}
        </Heading>
      ) : null}
      {hint !== undefined ? (
        <span className="absolute top-0 right-3 z-10 max-w-[40%] -translate-y-1/2 truncate rounded-[var(--radius)] bg-card px-2 font-mono text-xs text-muted-foreground select-none">
          {hint}
        </span>
      ) : null}
      <div
        className={cn(
          "flex min-w-0 flex-col gap-2",
          // Extra top padding when a chip half-overlaps the frame (chip ≈ 7 px inside).
          hasFrameLabels ? "px-2 pt-3 pb-2" : "p-2",
        )}
      >
        {children}
      </div>
    </div>
  );
}
