import { cn } from "cn";

/**
 * A label's colour is a **tone name**, and every tone is a full class string.
 *
 * The calendar module learned this the hard way: a computed `border-${color}` is invisible to
 * Tailwind's scanner, so the class is never generated and the chip renders with no colour at all —
 * a failure that is itself invisible, since the chip still looks like a chip. The map is the safe
 * shape, and it doubles as the list the picker offers and the service validates against.
 */
const TONES = {
  primary: "border-primary text-primary",
  info: "border-info text-info",
  success: "border-success text-success",
  warning: "border-warning text-warning",
  destructive: "border-destructive text-destructive",
  muted: "border-border text-muted-foreground",
} as const;

export type LabelColor = keyof typeof TONES;

export const LABEL_COLORS = Object.keys(TONES) as LabelColor[];

export const labelChip = (color: string | null | undefined, className?: string): string =>
  cn(
    "inline-flex items-center rounded-[var(--radius)] border px-1 font-mono text-[10px]",
    TONES[(color ?? "muted") as LabelColor] ?? TONES.muted,
    className,
  );
