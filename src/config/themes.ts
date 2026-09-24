/**
 * The single source of truth for themes and every customizer axis (spec §4.2, ADR-024,
 * RESEARCH §a option matrix). Adding a preset = adding one object here.
 *
 * Hex values are the spec's exact base colors (prompt.md §4.2). Tokens adjusted to pass
 * WCAG AA record their original spec hex in a comment and in ADR-033.
 * derivedTokens() mirrors the color-mix formulas in app/globals.css exactly — the
 * contrast test asserts both (formula parity is checked against the CSS file itself).
 */
import { bestForeground, mixSrgb } from "@/lib/color";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Presets (spec §4.2 table, verbatim hexes)
// ---------------------------------------------------------------------------

export type ColorMode = "light" | "dark";
export type ThemePresetId = "midnight" | "mocha" | "gruvbox" | "phosphor" | "amber" | "paper";

export interface ThemePreset {
  id: ThemePresetId;
  label: string;
  /** Which color mode this palette natively renders in (ADR-024 resolution rules). */
  nativeMode: ColorMode;
  background: string;
  /** Surface / card */
  card: string;
  border: string;
  foreground: string;
  mutedForeground: string;
  primary: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  accent: string;
}

export const themes: Record<ThemePresetId, ThemePreset> = {
  midnight: {
    id: "midnight",
    label: "Midnight",
    nativeMode: "dark",
    background: "#1a1b26",
    card: "#16161e",
    border: "#292e42",
    foreground: "#c0caf5",
    // spec #565f89 = 2.8:1 on background → adjusted (also passes on derived muted-fill), ADR-033
    mutedForeground: "#8b92b5",
    primary: "#7aa2f7",
    success: "#9ece6a",
    warning: "#e0af68",
    danger: "#f7768e",
    info: "#7dcfff",
    accent: "#bb9af7",
  },
  mocha: {
    id: "mocha",
    label: "Mocha",
    nativeMode: "dark",
    background: "#1e1e2e",
    card: "#181825",
    border: "#313244",
    foreground: "#cdd6f4",
    // spec #6c7086 = 3.4:1 on background → adjusted, see ADR-033
    mutedForeground: "#9399b2",
    primary: "#89b4fa",
    success: "#a6e3a1",
    warning: "#f9e2af",
    danger: "#f38ba8",
    info: "#94e2d5",
    accent: "#cba6f7",
  },
  gruvbox: {
    id: "gruvbox",
    label: "Gruvbox",
    nativeMode: "dark",
    background: "#282828",
    card: "#1d2021",
    border: "#3c3836",
    foreground: "#ebdbb2",
    // spec #928374 = 4.1:1 on background → adjusted (also passes on derived muted-fill), ADR-033
    mutedForeground: "#ae9f87",
    primary: "#83a598",
    success: "#b8bb26",
    warning: "#fabd2f",
    // spec #fb4934 = 4.3:1 on background → adjusted, see ADR-033
    danger: "#fb5d43",
    info: "#8ec07c",
    accent: "#d3869b",
  },
  phosphor: {
    id: "phosphor",
    label: "Phosphor",
    nativeMode: "dark",
    background: "#0b0f0b",
    card: "#080b08",
    border: "#1b2a1b",
    foreground: "#b6f0b6",
    // spec #4f7a4f = 3.9:1 on background → adjusted, see ADR-033
    mutedForeground: "#72a872",
    primary: "#39ff14",
    success: "#39ff14",
    warning: "#e6db74",
    danger: "#ff5555",
    info: "#5fd7af",
    accent: "#5fd7af",
  },
  amber: {
    id: "amber",
    label: "Amber",
    nativeMode: "dark",
    background: "#120d05",
    card: "#0d0903",
    border: "#2b2110",
    foreground: "#ffcf7a",
    // spec #8a6a2f = 3.6:1 on background → adjusted, see ADR-033
    mutedForeground: "#b08a45",
    primary: "#ffb000",
    success: "#a5d66b",
    warning: "#ffb000",
    danger: "#ff6b4a",
    info: "#ffd98a",
    accent: "#ffd98a",
  },
  paper: {
    id: "paper",
    label: "Paper",
    nativeMode: "light",
    background: "#faf7f0",
    card: "#ffffff",
    border: "#e2dccd",
    foreground: "#2b2a27",
    // spec #8a857a = 3.2:1 on background → adjusted (also passes on derived muted-fill), ADR-033
    mutedForeground: "#69655b",
    primary: "#2f5fb3",
    success: "#3d7a3a",
    // spec #9a6a12 = 4.4:1 on background → adjusted, see ADR-033
    warning: "#8a5e0f",
    danger: "#b3362f",
    // spec #1b7f8a = 4.3:1 on background → adjusted, see ADR-033
    info: "#156976",
    // spec #1b7f8a (Info/Accent column) — accent keeps the spec value (3:1 focus role), ADR-033
    accent: "#1b7f8a",
  },
};

export const THEME_PRESET_IDS = Object.keys(themes) as ThemePresetId[];

// ---------------------------------------------------------------------------
// Customizer axes (RESEARCH §a verbatim option names + spec §4.1 font list)
// ---------------------------------------------------------------------------

export const FONTS = [
  { id: "jetbrains-mono", label: "JetBrains Mono" },
  { id: "geist-mono", label: "Geist Mono" },
  { id: "fira-code", label: "Fira Code" },
  { id: "ibm-plex-mono", label: "IBM Plex Mono" },
] as const;

export const COLOR_MODES = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
] as const;

export const RADII = [
  { id: "none", label: "None", value: "0" },
  { id: "sm", label: "SM", value: "0.25rem" },
  { id: "md", label: "MD", value: "0.5rem" },
  { id: "lg", label: "LG", value: "0.75rem" },
] as const;

export const LAYOUTS = [
  { id: "compact", label: "Compact" },
  { id: "full", label: "Full" },
] as const;

export const SCALES = [
  { id: "sm", label: "SM", value: "14px" },
  { id: "md", label: "MD", value: "16px" },
  { id: "lg", label: "LG", value: "18px" },
] as const;

export const SIDEBAR_VARIANTS = [
  { id: "flush", label: "Flush" },
  { id: "inset", label: "Inset" },
  { id: "floating", label: "Floating" },
] as const;

export const SIDEBAR_MODES = [
  { id: "expanded", label: "Expanded" },
  { id: "icon", label: "Icon" },
  { id: "full", label: "Full" },
] as const;

// ---------------------------------------------------------------------------
// Overrides model — persisted in the cookie + user_settings.theme_overrides (ADR-024)
// ---------------------------------------------------------------------------

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a 6-digit hex color like #7aa2f7");

export const themeOverridesSchema = z.object({
  preset: z.enum(THEME_PRESET_IDS as [ThemePresetId, ...ThemePresetId[]]),
  colorMode: z.enum(["light", "dark", "system"]),
  font: z.enum(FONTS.map((f) => f.id) as [string, ...string[]]),
  /** spec §4.1 ligatures toggle; off = terminal default (ADR-034). */
  ligatures: z.enum(["on", "off"]),
  radius: z.enum(RADII.map((r) => r.id) as [string, ...string[]]),
  layout: z.enum(LAYOUTS.map((l) => l.id) as [string, ...string[]]),
  scale: z.enum(SCALES.map((s) => s.id) as [string, ...string[]]),
  sidebarVariant: z.enum(SIDEBAR_VARIANTS.map((v) => v.id) as [string, ...string[]]),
  sidebarMode: z.enum(SIDEBAR_MODES.map((m) => m.id) as [string, ...string[]]),
  /** One custom accent that regenerates primary/ring/chart tokens (spec §4.2), or null. */
  accent: hexColor.nullable(),
});

export type ThemeOverrides = z.infer<typeof themeOverridesSchema>;

export const DEFAULT_THEME: ThemeOverrides = {
  preset: "midnight",
  colorMode: "system",
  font: "jetbrains-mono",
  ligatures: "off",
  radius: "none",
  layout: "compact",
  scale: "md",
  sidebarVariant: "flush",
  sidebarMode: "expanded",
  accent: null,
};

/** Safe cookie parse: malformed/absent/partial values fall back per-field, never throw. */
export function parseThemeOverrides(raw: string | undefined | null): ThemeOverrides {
  if (!raw) return DEFAULT_THEME;
  try {
    const partial = themeOverridesSchema.partial().safeParse(JSON.parse(raw) as unknown);
    return partial.success ? { ...DEFAULT_THEME, ...partial.data } : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

// ---------------------------------------------------------------------------
// Resolution rules (ADR-024): preset ↔ color-mode → the palette that actually renders
// ---------------------------------------------------------------------------

export interface ResolvedTheme {
  /** Palette rendered on <html data-theme>. */
  theme: ThemePresetId;
  /** Effective light|dark after resolving `system` against the OS preference. */
  mode: ColorMode;
}

export function resolveTheme(overrides: ThemeOverrides, osDark: boolean): ResolvedTheme {
  const nativeDark = themes[overrides.preset].nativeMode === "dark";
  const mode: ColorMode =
    overrides.colorMode === "system" ? (osDark ? "dark" : "light") : overrides.colorMode;
  if (mode === "dark") return { theme: nativeDark ? overrides.preset : "midnight", mode };
  // light: Paper is the only light palette (spec §4.2)
  return { theme: "paper", mode };
}

// ---------------------------------------------------------------------------
// <html data-*> attribute map
// ---------------------------------------------------------------------------

export function themeAttrs(overrides: ThemeOverrides, osDark: boolean): Record<string, string> {
  const resolved = resolveTheme(overrides, osDark);
  return {
    "data-theme": resolved.theme,
    /** Resolved light|dark — powers the Tailwind `dark:` variant (ADR-034). */
    "data-mode": resolved.mode,
    "data-preset": overrides.preset,
    "data-color-mode": overrides.colorMode,
    "data-font": overrides.font,
    "data-ligatures": overrides.ligatures,
    "data-radius": overrides.radius,
    "data-layout": overrides.layout,
    "data-scale": overrides.scale,
    "data-sidebar-variant": overrides.sidebarVariant,
    "data-sidebar-mode": overrides.sidebarMode,
    "data-accent": overrides.accent ?? "default",
  };
}

// ---------------------------------------------------------------------------
// Custom accent regeneration (spec §4.2, ADR-034): a user-chosen accent becomes the
// primary/ring/chart tokens. Returned as an inline-style map for <html> (highest
// precedence over the preset blocks); `--ring: var(--accent)` and `--chart-1` follow
// automatically, the rest are set explicitly. Empty when no custom accent is set.
//
// Pure function shared by SSR, the live theme store and tests.
// ---------------------------------------------------------------------------

/** Keys `accentCssVars()` may set — the live store clears exactly these before re-applying. */
export const ACCENT_CSS_VARS = [
  "--accent",
  "--primary",
  "--primary-foreground",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
] as const;

export function accentCssVars(overrides: ThemeOverrides, osDark: boolean): Record<string, string> {
  const hex = overrides.accent;
  if (!hex) return {};
  const palette = themes[resolveTheme(overrides, osDark).theme];
  return {
    "--accent": hex,
    "--primary": hex,
    /* bestForeground() among four candidates always reaches ≥4.58:1 (worst-case
       midpoint of black/white), so custom accents cannot produce unreadable
       button text. */
    "--primary-foreground": bestForeground(hex, [
      palette.background,
      palette.foreground,
      "#000000",
      "#ffffff",
    ]),
    "--chart-1": hex,
    "--chart-2": mixSrgb(hex, palette.background, 0.18),
    "--chart-3": mixSrgb(hex, palette.background, 0.36),
    "--chart-4": mixSrgb(hex, palette.background, 0.54),
    "--chart-5": mixSrgb(hex, palette.background, 0.72),
  };
}

// ---------------------------------------------------------------------------
// Derived tokens — must mirror the color-mix formulas in app/globals.css exactly
// ---------------------------------------------------------------------------

export interface DerivedTokens {
  /** shadcn hover/menu surface (bg-accent utility) — NOT the vivid --accent brand token. */
  accentUi: string;
  mutedFill: string;
  secondaryFill: string;
  input: string;
  primaryForeground: string;
  secondaryForeground: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  popover: string;
  ring: string;
  chart: readonly [string, string, string, string, string];
}

export function derivedTokens(theme: ThemePreset): DerivedTokens {
  return {
    // globals.css: color-mix(in srgb, var(--foreground) 7%|8%|5%, var(--background))
    accentUi: mixSrgb(theme.foreground, theme.background, 0.93),
    mutedFill: mixSrgb(theme.foreground, theme.background, 0.92),
    secondaryFill: mixSrgb(theme.foreground, theme.background, 0.95),
    // globals.css: color-mix(in srgb, var(--border) 50%, var(--foreground))
    input: mixSrgb(theme.border, theme.foreground, 0.5),
    // globals.css: --primary-foreground: var(--background)
    primaryForeground: theme.background,
    secondaryForeground: theme.foreground,
    accentForeground: theme.foreground,
    destructive: theme.danger,
    destructiveForeground: theme.background,
    popover: theme.card,
    // globals.css: --ring: var(--accent) — follows custom accent regeneration for free
    ring: theme.accent,
    // globals.css: --chart-1..5: primary, success, warning, destructive, info
    chart: [theme.primary, theme.success, theme.warning, theme.danger, theme.info],
  };
}
