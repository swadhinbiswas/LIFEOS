import { cn } from "cn";

export interface SparkProps {
  /** One number per point, oldest → newest. Non-finite entries count as 0. */
  values: number[];
  /** Accessible name for the chart (spec §4.4 — full screen-reader labels). */
  label: string;
  /**
   * `braille` (default): a 2×4-dot-per-cell bitmap, the classic dense sparkline.
   * `blocks`: one `▁▂▃▄▅▆▇█` glyph per value — no sampling, `cells` does not apply.
   */
  variant?: "braille" | "blocks";
  /** Width in cells for the braille variant; default 12 (→ 24 sampled dot columns). */
  cells?: number;
  className?: string;
}

const BRAILLE_BASE = 0x2800;
/** Dot bits per (column, row): left column rows 0–3 then right column rows 0–3. */
const DOT_BITS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0x01, 0x02, 0x04, 0x40],
  [0x08, 0x10, 0x20, 0x80],
];
const BLOCK_RAMP = "▁▂▃▄▅▆▇█";

const normalize = (values: number[]): { nums: number[]; min: number; span: number } => {
  const nums = values.map((v) => (Number.isFinite(v) ? v : 0));
  if (nums.length === 0) return { nums, min: 0, span: 0 };
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return { nums, min, span: max - min };
};

/** 0…1 position of a value within the series range; flat series sit at 0 (relative scaling). */
const normOf = (v: number, min: number, span: number): number =>
  span === 0 ? 0 : (v - min) / span;

/** Row index 0…3 for the braille bitmap (4 dot rows). */
const rowOf = (v: number, min: number, span: number): number =>
  Math.min(3, Math.max(0, Math.round(normOf(v, min, span) * 3)));

function brailleSparkline(values: number[], cells: number): string {
  const { nums, min, span } = normalize(values);
  if (nums.length === 0) return "";
  const width = Math.max(1, Math.round(cells));
  const columns = width * 2;
  let out = "";
  for (let cell = 0; cell < width; cell += 1) {
    let bits = 0;
    for (let col = 0; col < 2; col += 1) {
      const index =
        nums.length === 1 ? 0 : Math.round(((cell * 2 + col) * (nums.length - 1)) / (columns - 1));
      const row = rowOf(nums[index] ?? 0, min, span);
      bits |= DOT_BITS[col]?.[row] ?? 0;
    }
    out += String.fromCodePoint(BRAILLE_BASE + bits);
  }
  return out;
}

function blockSparkline(values: number[]): string {
  const { nums, min, span } = normalize(values);
  // Direct 0…7 mapping: the block ramp has eight levels, so it must not go through the
  // braille bitmap's four-row quantization (that double-rounds 0.5 to ▆ instead of ▅).
  return nums
    .map((v) => BLOCK_RAMP[Math.min(7, Math.max(0, Math.round(normOf(v, min, span) * 7)))] ?? "▁")
    .join("");
}

/**
 * Compact chart for dashboard widgets: braille sparkline by default, `▁▂▃▄▅▆▇█` block ramp
 * as the alternative (spec §4.1 "braille sparklines"). Scales to the visible min/max of the
 * series — exact figures belong in the panel around it, this shows shape.
 */
export function Spark({ values, label, variant = "braille", cells = 12, className }: SparkProps) {
  const glyphs = variant === "blocks" ? blockSparkline(values) : brailleSparkline(values, cells);
  return (
    <span
      role="img"
      aria-label={label}
      data-slot="spark"
      className={cn("font-mono text-primary tabular-nums whitespace-nowrap", className)}
    >
      {glyphs}
    </span>
  );
}
