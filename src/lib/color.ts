/**
 * WCAG color math + sRGB mixing (spec §4.2: automated contrast test; ADR-033).
 *
 * mixSrgb mirrors CSS `color-mix(in srgb, …)` (per-channel gamma-encoded lerp),
 * so unit tests compute exactly what the browser renders from globals.css.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isHex(value: string): boolean {
  return HEX_RE.test(value);
}

/** @throws if `hex` is not a 6-digit hex color — callers pass validated config values. */
export function hexToRgb(hex: string): Rgb {
  if (!isHex(hex)) throw new Error(`not a 6-digit hex color: ${hex}`);
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function channelToLinear(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance (0..1). */
export function relativeLuminance(rgb: Rgb): number {
  return (
    0.2126 * channelToLinear(rgb.r) +
    0.7152 * channelToLinear(rgb.g) +
    0.0722 * channelToLinear(rgb.b)
  );
}

export function luminanceOfHex(hex: string): number {
  return relativeLuminance(hexToRgb(hex));
}

/** WCAG contrast ratio (1..21), symmetric. */
export function contrastRatio(a: string, b: string): number {
  const la = luminanceOfHex(a);
  const lb = luminanceOfHex(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Per-channel lerp in gamma-encoded sRGB — parity with `color-mix(in srgb, from T%, to)`.
 * `t` is the share of `to` (0 = from, 1 = to). Channels stay fractional (browser rounds).
 */
export function mixSrgb(from: string, to: string, t: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const clamped = Math.min(1, Math.max(0, t));
  const mix = (x: number, y: number): number => x + (y - x) * clamped;
  const hex2 = (n: number): string =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${hex2(mix(a.r, b.r))}${hex2(mix(a.g, b.g))}${hex2(mix(a.b, b.b))}`;
}

/**
 * Minimal nudge that reaches `min` contrast: pushes `fg` toward white (when it is
 * the lighter side) or black, keeping hue direction. Used to print fix suggestions
 * from the contrast test — not applied silently.
 */
export function suggestNudge(fg: string, bg: string, min: number): string {
  const toward = luminanceOfHex(fg) >= luminanceOfHex(bg) ? "#ffffff" : "#000000";
  for (let t = 0.01; t <= 1.0001; t += 0.01) {
    const candidate = mixSrgb(fg, toward, t);
    if (contrastRatio(candidate, bg) >= min) {
      return `${candidate} (mix ${Math.round(t * 100)}% toward ${toward})`;
    }
  }
  return "no single-step nudge found";
}

/**
 * Picks the best foreground for text drawn on `bg` among candidates, preferring the
 * highest contrast. Used when a custom accent becomes --primary (spec §4.2).
 */
export function bestForeground(bg: string, candidates: readonly string[]): string {
  let best = candidates[0];
  if (best === undefined) throw new Error("bestForeground requires at least one candidate");
  let bestRatio = contrastRatio(best, bg);
  for (const candidate of candidates.slice(1)) {
    const ratio = contrastRatio(candidate, bg);
    if (ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
  }
  return best;
}
