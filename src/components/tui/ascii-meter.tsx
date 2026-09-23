import { cn } from "cn";

export interface AsciiMeterProps {
  /** Progress as 0…1; clamped (values outside the range saturate, non-finite → 0). */
  value: number;
  /** Accessible name — required, color/glyphs are never the only signal (spec §4.4). */
  label: string;
  /** Width of the meter in cells; default 10. */
  cells?: number;
  /** Append the numeric percentage after the cells; default true (spec §4.1 example). */
  showValue?: boolean;
  className?: string;
}

/**
 * Unicode block meter — `▰▰▰▰▱▱ 66%` (spec §4.1 "ASCII/Unicode-styled meters").
 * Exposed to assistive tech as a real `progressbar` with `aria-valuenow`; the glyph run is
 * decorative (`aria-hidden`) and the visible percentage carries the exact value.
 */
export function AsciiMeter({
  value,
  label,
  cells = 10,
  showValue = true,
  className,
}: AsciiMeterProps) {
  const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const percent = Math.round(clamped * 100);
  const width = Math.max(1, Math.round(cells));
  const filled = Math.round(clamped * width);

  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      data-slot="ascii-meter"
      className={cn("inline-flex items-center gap-2 font-mono text-xs tabular-nums", className)}
    >
      <span aria-hidden="true" className="tracking-tight">
        <span className="text-primary">{"▰".repeat(filled)}</span>
        <span className="text-muted-foreground">{"▱".repeat(width - filled)}</span>
      </span>
      {showValue ? <span className="text-muted-foreground">{percent}%</span> : null}
    </span>
  );
}
