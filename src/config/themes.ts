/**
 * The single source of truth for themes and every customizer axis (spec §4.2, ADR-024,
 * RESEARCH §a option matrix). Adding a preset = adding one object here.
 *
 * Hex values are the spec's exact base colors (prompt.md §4.2). Tokens adjusted to pass
 * WCAG AA record their original spec hex in a comment and in ADR-033.
 * derivedTokens() mirrors the color-mix formulas in app/globals.css exactly — the
 * contrast test asserts both (formula parity is checked against the CSS file itself).
 */
import { bestForeground, contrastRatio, luminanceOfHex, mixSrgb } from "@/lib/color";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Presets (spec §4.2 table, verbatim hexes)
// ---------------------------------------------------------------------------

export type ColorMode = "light" | "dark";
export type ThemePresetId =
  | "midnight"
  | "mocha"
  | "gruvbox"
  | "phosphor"
  | "amber"
  | "paper"
  | "oc-aura"
  | "oc-ayu"
  | "oc-carbonfox"
  | "oc-catppuccin-frappe"
  | "oc-catppuccin-macchiato"
  | "oc-catppuccin"
  | "oc-cobalt2"
  | "oc-cursor"
  | "oc-dracula"
  | "oc-everforest"
  | "oc-flexoki"
  | "oc-github"
  | "oc-gruvbox"
  | "oc-kanagawa"
  | "oc-lucent-orng"
  | "oc-material"
  | "oc-matrix"
  | "oc-mercury"
  | "oc-monokai"
  | "oc-nightowl"
  | "oc-nord"
  | "oc-one-dark"
  | "oc-opencode"
  | "oc-orng"
  | "oc-osaka-jade"
  | "oc-palenight"
  | "oc-rosepine"
  | "oc-solarized"
  | "oc-synthwave84"
  | "oc-tokyonight"
  | "oc-vercel"
  | "oc-vesper"
  | "oc-zenburn";

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
  /**
   * Optional chart palette (ADR-098). Text tokens are adjusted to clear 4.5:1, which can wash a
   * series out to near-white; charts only need 3:1, so imported themes keep their authentic hues
   * here. Falls back to `[primary, success, warning, danger, info]`.
   */
  chart?: readonly [string, string, string, string, string];
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

  /* --- OpenCode themes (imported by scripts/import-opencode-themes.mjs) --- */
  "oc-aura": {
    id: "oc-aura",
    label: "Aura",
    nativeMode: "dark",
    // OpenCode border #2d2d2d → adjusted for WCAG AA (ADR-033)
    // OpenCode mutedForeground #6d6d6d → adjusted for WCAG AA (ADR-033)
    background: "#0f0f0f",
    card: "#15141b",
    border: "#636363",
    foreground: "#edecee",
    mutedForeground: "#898989",
    primary: "#a277ff",
    success: "#61ffca",
    warning: "#ffca85",
    danger: "#ff6767",
    info: "#a277ff",
    accent: "#a277ff",
    chart: ["#a277ff", "#61ffca", "#ffca85", "#ff6767", "#e677ff"],
  },
  "oc-ayu": {
    id: "oc-ayu",
    label: "Ayu",
    nativeMode: "dark",
    // OpenCode mutedForeground #565b66 → adjusted for WCAG AA (ADR-033)
    // OpenCode danger #d95757 → adjusted for WCAG AA (ADR-033)
    background: "#0b0e14",
    card: "#0f131a",
    border: "#6c7380",
    foreground: "#bfbdb6",
    mutedForeground: "#7f8693",
    primary: "#59c2ff",
    success: "#7fd962",
    warning: "#e6b673",
    danger: "#da5b5b",
    info: "#39bae6",
    accent: "#e6b450",
    chart: ["#59c2ff", "#7fd962", "#e6b673", "#d95757", "#39bae6"],
  },
  "oc-carbonfox": {
    id: "oc-carbonfox",
    label: "Carbonfox",
    nativeMode: "dark",
    // OpenCode border #303030 → adjusted for WCAG AA (ADR-033)
    // OpenCode mutedForeground #7d848f → adjusted for WCAG AA (ADR-033)
    // OpenCode danger #ee5396 → adjusted for WCAG AA (ADR-033)
    background: "#161616",
    card: "#1a1a1a",
    border: "#666666",
    foreground: "#f2f4f8",
    mutedForeground: "#8b919b",
    primary: "#33b1ff",
    success: "#25be6a",
    warning: "#f1c21b",
    danger: "#ee5899",
    info: "#78a9ff",
    accent: "#ff7eb6",
    chart: ["#33b1ff", "#25be6a", "#f1c21b", "#ee5396", "#78a9ff"],
  },
  "oc-catppuccin-frappe": {
    id: "oc-catppuccin-frappe",
    label: "Catppuccin Frappé",
    nativeMode: "dark",
    // OpenCode border #414559 → adjusted for WCAG AA (ADR-033)
    // OpenCode mutedForeground #949cb8 → adjusted for WCAG AA (ADR-033)
    // OpenCode primary #8da4e2 → adjusted for WCAG AA (ADR-033)
    // OpenCode danger #e78284 → adjusted for WCAG AA (ADR-033)
    background: "#303446",
    card: "#292c3c",
    border: "#787e9c",
    foreground: "#c6d0f5",
    mutedForeground: "#a6adc4",
    primary: "#99aee5",
    success: "#a6d189",
    warning: "#e5c890",
    danger: "#eb9799",
    info: "#81c8be",
    accent: "#f4b8e4",
    chart: ["#8da4e2", "#a6d189", "#e5c890", "#e78284", "#81c8be"],
  },
  "oc-catppuccin-macchiato": {
    id: "oc-catppuccin-macchiato",
    label: "Catppuccin Macchiato",
    nativeMode: "dark",
    // OpenCode border #363a4f → adjusted for WCAG AA (ADR-033)
    // OpenCode mutedForeground #939ab7 → adjusted for WCAG AA (ADR-033)
    background: "#24273a",
    card: "#1e2030",
    border: "#686f98",
    foreground: "#cad3f5",
    mutedForeground: "#969db9",
    primary: "#8aadf4",
    success: "#a6da95",
    warning: "#eed49f",
    danger: "#ed8796",
    info: "#8bd5ca",
    accent: "#f5bde6",
    chart: ["#8aadf4", "#a6da95", "#eed49f", "#ed8796", "#8bd5ca"],
  },
  "oc-catppuccin": {
    id: "oc-catppuccin",
    label: "Catppuccin",
    nativeMode: "dark",
    // OpenCode border #313244 → adjusted for WCAG AA (ADR-033)
    background: "#1e1e2e",
    card: "#181825",
    border: "#66688e",
    foreground: "#cdd6f4",
    mutedForeground: "#9399b2",
    primary: "#89b4fa",
    success: "#a6e3a1",
    warning: "#f9e2af",
    danger: "#f38ba8",
    info: "#94e2d5",
    accent: "#f5c2e7",
    chart: ["#89b4fa", "#a6e3a1", "#f9e2af", "#f38ba8", "#94e2d5"],
  },
  "oc-cobalt2": {
    id: "oc-cobalt2",
    label: "Cobalt2",
    nativeMode: "dark",
    // OpenCode border #1f4662 → adjusted for WCAG AA (ADR-033)
    // OpenCode primary #0088ff → adjusted for WCAG AA (ADR-033)
    // OpenCode danger #ff0088 → adjusted for WCAG AA (ADR-033)
    background: "#193549",
    card: "#122738",
    border: "#3a83b7",
    foreground: "#ffffff",
    mutedForeground: "#adb7c9",
    primary: "#61b5ff",
    success: "#9eff80",
    warning: "#ffc600",
    danger: "#ff8ac8",
    info: "#ff9d00",
    accent: "#2affdf",
    chart: ["#0088ff", "#9eff80", "#ffc600", "#ff0088", "#ff9d00"],
  },
  "oc-cursor": {
    id: "oc-cursor",
    label: "Cursor",
    nativeMode: "dark",
    // OpenCode border #272727 → adjusted for WCAG AA (ADR-033)
    // OpenCode mutedForeground #636363 → adjusted for WCAG AA (ADR-033)
    // OpenCode danger #e34671 → adjusted for WCAG AA (ADR-033)
    background: "#181818",
    card: "#141414",
    border: "#646464",
    foreground: "#e4e4e4",
    mutedForeground: "#8e8e8e",
    primary: "#88c0d0",
    success: "#3fa266",
    warning: "#f1b467",
    danger: "#e76185",
    info: "#81a1c1",
    accent: "#88c0d0",
    chart: ["#88c0d0", "#3fa266", "#f1b467", "#e34671", "#81a1c1"],
  },
  "oc-dracula": {
    id: "oc-dracula",
    label: "Dracula",
    nativeMode: "dark",
    // OpenCode border #44475a → adjusted for WCAG AA (ADR-033)
    // OpenCode mutedForeground #6272a4 → adjusted for WCAG AA (ADR-033)
    // OpenCode danger #ff5555 → adjusted for WCAG AA (ADR-033)
    background: "#282a36",
    card: "#21222c",
    border: "#6e7391",
    foreground: "#f8f8f2",
    mutedForeground: "#9ca6c6",
    primary: "#bd93f9",
    success: "#50fa7b",
    warning: "#f1fa8c",
    danger: "#ff7e7e",
    info: "#ffb86c",
    accent: "#8be9fd",
    chart: ["#bd93f9", "#50fa7b", "#f1fa8c", "#ff5555", "#ffb86c"],
  },
  "oc-everforest": {
    id: "oc-everforest",
    label: "Everforest",
    nativeMode: "dark",
    // OpenCode mutedForeground #7a8478 → adjusted for WCAG AA (ADR-033)
    // OpenCode danger #e67e80 → adjusted for WCAG AA (ADR-033)
    background: "#2d353b",
    card: "#333c43",
    border: "#859289",
    foreground: "#d3c6aa",
    mutedForeground: "#a7ada5",
    primary: "#a7c080",
    success: "#a7c080",
    warning: "#e69875",
    danger: "#ea9395",
    info: "#83c092",
    accent: "#d699b6",
    chart: ["#a7c080", "#87c080", "#e69875", "#e67e80", "#83c092"],
  },
  "oc-flexoki": {
    id: "oc-flexoki",
    label: "Flexoki",
    nativeMode: "dark",
    // OpenCode border #575653 → adjusted for WCAG AA (ADR-033)
    // OpenCode mutedForeground #6f6e69 → adjusted for WCAG AA (ADR-033)
    // OpenCode danger #d14d41 → adjusted for WCAG AA (ADR-033)
    background: "#100f0f",
    card: "#1c1b1a",
    border: "#696864",
    foreground: "#cecdc3",
    mutedForeground: "#868580",
    primary: "#da702c",
    success: "#879a39",
    warning: "#da702c",
    danger: "#d7645a",
    info: "#3aa99f",
    accent: "#8b7ec8",
    chart: ["#da702c", "#879a39", "#dac72c", "#d14d41", "#3aa99f"],
  },
  "oc-github": {
    id: "oc-github",
    label: "GitHub",
    nativeMode: "dark",
    // OpenCode border #30363d → adjusted for WCAG AA (ADR-033)
    background: "#0d1117",
    card: "#010409",
    border: "#56616e",
    foreground: "#c9d1d9",
    mutedForeground: "#8b949e",
    primary: "#58a6ff",
    success: "#3fb950",
    warning: "#e3b341",
    danger: "#f85149",
    info: "#d29922",
    accent: "#39c5cf",
    chart: ["#58a6ff", "#3fb950", "#e3b341", "#f85149", "#d29922"],
  },
  "oc-gruvbox": {
    id: "oc-gruvbox",
    label: "Gruvbox (OpenCode)",
    nativeMode: "dark",
    // OpenCode border #665c54 → adjusted for WCAG AA (ADR-033)
    // OpenCode mutedForeground #928374 → adjusted for WCAG AA (ADR-033)
    // OpenCode primary #83a598 → adjusted for WCAG AA (ADR-033)
    // OpenCode danger #fb4934 → adjusted for WCAG AA (ADR-033)
    background: "#282828",
    card: "#3c3836",
    border: "#8f8277",
    foreground: "#ebdbb2",
    mutedForeground: "#ada296",
    primary: "#89a99d",
    success: "#b8bb26",
    warning: "#fe8019",
    danger: "#fc7f70",
    info: "#fabd2f",
    accent: "#8ec07c",
    chart: ["#83a598", "#b8bb26", "#fe8019", "#fb4934", "#fabd2f"],
  },
  "oc-kanagawa": {
    id: "oc-kanagawa",
    label: "Kanagawa",
    nativeMode: "dark",
    // OpenCode border #54546d → adjusted for WCAG AA (ADR-033)
    // OpenCode mutedForeground #727169 → adjusted for WCAG AA (ADR-033)
    // OpenCode danger #e82424 → adjusted for WCAG AA (ADR-033)
    // OpenCode info #76946a → adjusted for WCAG AA (ADR-033)
    background: "#1f1f28",
    card: "#2a2a37",
    border: "#717192",
    foreground: "#dcd7ba",
    mutedForeground: "#98978f",
    primary: "#7e9cd8",
    success: "#98bb6c",
    warning: "#d7a657",
    danger: "#f06e6e",
    info: "#819d76",
    accent: "#d27e99",
    chart: ["#7e9cd8", "#98bb6c", "#d7a657", "#e82424", "#76946a"],
  },
  "oc-lucent-orng": {
    id: "oc-lucent-orng",
    label: "Lucent Orng",
    nativeMode: "dark",
    // OpenCode background is 'transparent' (terminal default) → a solid base (ADR-096)
    // OpenCode mutedForeground #808080 → adjusted for WCAG AA (ADR-033)
    background: "#0a0a0a",
    card: "#0a0a0a",
    border: "#ec5b2b",
    foreground: "#eeeeee",
    mutedForeground: "#858585",
    primary: "#ec5b2b",
    success: "#6ba1e6",
    warning: "#ec5b2b",
    danger: "#e06c75",
    info: "#56b6c2",
    accent: "#fff7f1",
    chart: ["#ec5b2b", "#6ba1e6", "#ecbc2b", "#e06c75", "#56b6c2"],
  },
  "oc-material": {
    id: "oc-material",
    label: "Material",
    nativeMode: "dark",
    // OpenCode border #37474f → adjusted for WCAG AA (ADR-033)
    // OpenCode mutedForeground #546e7a → adjusted for WCAG AA (ADR-033)
    // OpenCode danger #f07178 → adjusted for WCAG AA (ADR-033)
    background: "#263238",
    card: "#1e272c",
    border: "#617d8b",
    foreground: "#eeffff",
    mutedForeground: "#99afb9",
    primary: "#82aaff",
    success: "#c3e88d",
    warning: "#ffcb6b",
    danger: "#f39197",
    info: "#ffcb6b",
    accent: "#89ddff",
    chart: ["#82aaff", "#c3e88d", "#ffcb6b", "#f07178", "#e9ff6b"],
  },
  "oc-matrix": {
    id: "oc-matrix",
    label: "Matrix",
    nativeMode: "dark",
    // OpenCode border #1e2a1b → adjusted for WCAG AA (ADR-033)
    background: "#0a0e0a",
    card: "#0e130d",
    border: "#4d6b45",
    foreground: "#62ff94",
    mutedForeground: "#8ca391",
    primary: "#2eff6a",
    success: "#62ff94",
    warning: "#e6ff57",
    danger: "#ff4b4b",
    info: "#30b3ff",
    accent: "#c770ff",
    chart: ["#2eff6a", "#62ff94", "#e6ff57", "#ff4b4b", "#30b3ff"],
  },
  "oc-mercury": {
    id: "oc-mercury",
    label: "Mercury",
    nativeMode: "dark",
    // OpenCode border #2a2a35 → adjusted for WCAG AA (ADR-033)
    background: "#171721",
    card: "#10101a",
    border: "#62627c",
    foreground: "#dddde5",
    mutedForeground: "#9d9da8",
    primary: "#8da4f5",
    success: "#77c599",
    warning: "#fc9b6f",
    danger: "#fc92b4",
    info: "#77becf",
    accent: "#8da4f5",
    chart: ["#8da4f5", "#77c599", "#fc9b6f", "#fc92b4", "#77becf"],
  },
  "oc-monokai": {
    id: "oc-monokai",
    label: "Monokai",
    nativeMode: "dark",
    // OpenCode border #3e3d32 → adjusted for WCAG AA (ADR-033)
    // OpenCode mutedForeground #75715e → adjusted for WCAG AA (ADR-033)
    // OpenCode danger #f92672 → adjusted for WCAG AA (ADR-033)
    background: "#272822",
    card: "#1e1f1c",
    border: "#74725d",
    foreground: "#f8f8f2",
    mutedForeground: "#a7a492",
    primary: "#66d9ef",
    success: "#a6e22e",
    warning: "#e6db74",
    danger: "#fb75a6",
    info: "#fd971f",
    accent: "#a6e22e",
    chart: ["#66d9ef", "#a6e22e", "#e6db74", "#f92672", "#fd971f"],
  },
  "oc-nightowl": {
    id: "oc-nightowl",
    label: "Night Owl",
    nativeMode: "dark",
    // OpenCode mutedForeground #5f7e97 → adjusted for WCAG AA (ADR-033)
    // OpenCode danger #ef5350 → adjusted for WCAG AA (ADR-033)
    background: "#011627",
    card: "#0b253a",
    border: "#5f7e97",
    foreground: "#d6deeb",
    mutedForeground: "#7390a7",
    primary: "#82aaff",
    success: "#c5e478",
    warning: "#ecc48d",
    danger: "#ef5855",
    info: "#82aaff",
    accent: "#c792ea",
    chart: ["#82aaff", "#c5e478", "#ecc48d", "#ef5350", "#9982ff"],
  },
  "oc-nord": {
    id: "oc-nord",
    label: "Nord",
    nativeMode: "dark",
    // OpenCode border #434c5e → adjusted for WCAG AA (ADR-033)
    // OpenCode mutedForeground #8b95a7 → adjusted for WCAG AA (ADR-033)
    // OpenCode warning #d08770 → adjusted for WCAG AA (ADR-033)
    // OpenCode danger #bf616a → adjusted for WCAG AA (ADR-033)
    background: "#2e3440",
    card: "#3b4252",
    border: "#818da5",
    foreground: "#eceff4",
    mutedForeground: "#a8afbd",
    primary: "#88c0d0",
    success: "#a3be8c",
    warning: "#dba493",
    danger: "#d9a2a8",
    info: "#88c0d0",
    accent: "#8fbcbb",
    chart: ["#88c0d0", "#a3be8c", "#d08770", "#d9a2a8", "#889cd0"],
  },
  "oc-one-dark": {
    id: "oc-one-dark",
    label: "One Dark",
    nativeMode: "dark",
    // OpenCode border #393f4a → adjusted for WCAG AA (ADR-033)
    // OpenCode mutedForeground #5c6370 → adjusted for WCAG AA (ADR-033)
    // OpenCode danger #e06c75 → adjusted for WCAG AA (ADR-033)
    background: "#282c34",
    card: "#21252b",
    border: "#6a7589",
    foreground: "#abb2bf",
    mutedForeground: "#9aa1ac",
    primary: "#61afef",
    success: "#98c379",
    warning: "#e5c07b",
    danger: "#e5858d",
    info: "#d19a66",
    accent: "#56b6c2",
    chart: ["#61afef", "#98c379", "#e5c07b", "#e06c75", "#d19a66"],
  },
  "oc-opencode": {
    id: "oc-opencode",
    label: "OpenCode",
    nativeMode: "dark",
    // OpenCode border #484848 → adjusted for WCAG AA (ADR-033)
    // OpenCode mutedForeground #808080 → adjusted for WCAG AA (ADR-033)
    background: "#0a0a0a",
    card: "#141414",
    border: "#626262",
    foreground: "#eeeeee",
    mutedForeground: "#858585",
    primary: "#fab283",
    success: "#7fd88f",
    warning: "#f5a742",
    danger: "#e06c75",
    info: "#56b6c2",
    accent: "#9d7cd8",
    chart: ["#fab283", "#7fd88f", "#f5a742", "#e06c75", "#56b6c2"],
  },
  "oc-orng": {
    id: "oc-orng",
    label: "Orng",
    nativeMode: "dark",
    // OpenCode mutedForeground #808080 → adjusted for WCAG AA (ADR-033)
    background: "#0a0a0a",
    card: "#141414",
    border: "#ec5b2b",
    foreground: "#eeeeee",
    mutedForeground: "#858585",
    primary: "#ec5b2b",
    success: "#6ba1e6",
    warning: "#ec5b2b",
    danger: "#e06c75",
    info: "#56b6c2",
    accent: "#fff7f1",
    chart: ["#ec5b2b", "#6ba1e6", "#ecbc2b", "#e06c75", "#56b6c2"],
  },
  "oc-osaka-jade": {
    id: "oc-osaka-jade",
    label: "Osaka Jade",
    nativeMode: "dark",
    // OpenCode border #3d4a44 → adjusted for WCAG AA (ADR-033)
    // OpenCode mutedForeground #53685b → adjusted for WCAG AA (ADR-033)
    background: "#111c18",
    card: "#1a2520",
    border: "#5d7168",
    foreground: "#c1c497",
    mutedForeground: "#799483",
    primary: "#2dd5b7",
    success: "#549e6a",
    warning: "#e5c736",
    danger: "#ff5345",
    info: "#2dd5b7",
    accent: "#549e6a",
    chart: ["#2dd5b7", "#549e6a", "#e5c736", "#ff5345", "#2d9fd5"],
  },
  "oc-palenight": {
    id: "oc-palenight",
    label: "Palenight",
    nativeMode: "dark",
    // OpenCode border #3e435c → adjusted for WCAG AA (ADR-033)
    // OpenCode mutedForeground #676e95 → adjusted for WCAG AA (ADR-033)
    // OpenCode danger #f07178 → adjusted for WCAG AA (ADR-033)
    background: "#292d3e",
    card: "#1e2132",
    border: "#6d759d",
    foreground: "#a6accd",
    mutedForeground: "#9da1bb",
    primary: "#82aaff",
    success: "#c3e88d",
    warning: "#ffcb6b",
    danger: "#f17f85",
    info: "#f78c6c",
    accent: "#89ddff",
    chart: ["#82aaff", "#c3e88d", "#ffcb6b", "#f07178", "#f78c6c"],
  },
  "oc-rosepine": {
    id: "oc-rosepine",
    label: "Rosé Pine",
    nativeMode: "dark",
    // OpenCode border #403d52 → adjusted for WCAG AA (ADR-033)
    // OpenCode mutedForeground #6e6a86 → adjusted for WCAG AA (ADR-033)
    // OpenCode success #31748f → adjusted for WCAG AA (ADR-033)
    background: "#191724",
    card: "#1f1d2e",
    border: "#6b668a",
    foreground: "#e0def4",
    mutedForeground: "#918da5",
    primary: "#9ccfd8",
    success: "#4199bd",
    warning: "#f6c177",
    danger: "#eb6f92",
    info: "#9ccfd8",
    accent: "#ebbcba",
    chart: ["#9ccfd8", "#31748f", "#f6c177", "#eb6f92", "#9cb1d8"],
  },
  "oc-solarized": {
    id: "oc-solarized",
    label: "Solarized",
    nativeMode: "dark",
    // OpenCode foreground #839496 → adjusted for WCAG AA (ADR-033)
    // OpenCode border #0d6f88 → adjusted for WCAG AA (ADR-033)
    // OpenCode mutedForeground #586e75 → adjusted for WCAG AA (ADR-033)
    // OpenCode primary #268bd2 → adjusted for WCAG AA (ADR-033)
    // OpenCode success #859900 → adjusted for WCAG AA (ADR-033)
    // OpenCode warning #b58900 → adjusted for WCAG AA (ADR-033)
    // OpenCode danger #dc322f → adjusted for WCAG AA (ADR-033)
    // OpenCode info #cb4b16 → adjusted for WCAG AA (ADR-033)
    background: "#002b36",
    card: "#073642",
    border: "#1086a4",
    foreground: "#8b9b9d",
    mutedForeground: "#859ca3",
    primary: "#48a0de",
    success: "#8ea300",
    warning: "#c49500",
    danger: "#e87775",
    info: "#ec7b4c",
    accent: "#2aa198",
    chart: ["#268bd2", "#859900", "#b58900", "#e87775", "#ec7b4c"],
  },
  "oc-synthwave84": {
    id: "oc-synthwave84",
    label: "Synthwave 84",
    nativeMode: "dark",
    // OpenCode border #495495 → adjusted for WCAG AA (ADR-033)
    // OpenCode mutedForeground #848bbd → adjusted for WCAG AA (ADR-033)
    // OpenCode danger #fe4450 → adjusted for WCAG AA (ADR-033)
    background: "#262335",
    card: "#1e1a29",
    border: "#606cb1",
    foreground: "#ffffff",
    mutedForeground: "#989ec8",
    primary: "#36f9f6",
    success: "#72f1b8",
    warning: "#fede5d",
    danger: "#fe777f",
    info: "#ff8b39",
    accent: "#b084eb",
    chart: ["#36f9f6", "#72f1b8", "#fede5d", "#fe4450", "#ff8b39"],
  },
  "oc-tokyonight": {
    id: "oc-tokyonight",
    label: "Tokyo Night",
    nativeMode: "dark",
    // OpenCode mutedForeground #828bb8 → adjusted for WCAG AA (ADR-033)
    background: "#1a1b26",
    card: "#1e2030",
    border: "#737aa2",
    foreground: "#c8d3f5",
    mutedForeground: "#8991bc",
    primary: "#82aaff",
    success: "#c3e88d",
    warning: "#ff966c",
    danger: "#ff757f",
    info: "#82aaff",
    accent: "#ff966c",
    chart: ["#82aaff", "#c3e88d", "#ff966c", "#ff757f", "#9982ff"],
  },
  "oc-vercel": {
    id: "oc-vercel",
    label: "Vercel",
    nativeMode: "dark",
    // OpenCode border #1f1f1f → adjusted for WCAG AA (ADR-033)
    // OpenCode primary #0070f3 → adjusted for WCAG AA (ADR-033)
    // OpenCode danger #e5484d → adjusted for WCAG AA (ADR-033)
    background: "#000000",
    card: "#1a1a1a",
    border: "#666666",
    foreground: "#ededed",
    mutedForeground: "#878787",
    primary: "#1380ff",
    success: "#46a758",
    warning: "#ffb224",
    danger: "#e64c51",
    info: "#52a8ff",
    accent: "#8e4ec6",
    chart: ["#0070f3", "#46a758", "#ffb224", "#e5484d", "#52a8ff"],
  },
  "oc-vesper": {
    id: "oc-vesper",
    label: "Vesper",
    nativeMode: "dark",
    // OpenCode border #282828 → adjusted for WCAG AA (ADR-033)
    background: "#101010",
    card: "#101010",
    border: "#606060",
    foreground: "#ffffff",
    mutedForeground: "#a0a0a0",
    primary: "#ffc799",
    success: "#99ffe4",
    warning: "#ffc799",
    danger: "#ff8080",
    info: "#ffc799",
    accent: "#ffc799",
    chart: ["#ffc799", "#99ffe4", "#fffa99", "#ff8080", "#ff999e"],
  },
  "oc-zenburn": {
    id: "oc-zenburn",
    label: "Zenburn",
    nativeMode: "dark",
    // OpenCode border #5f5f5f → adjusted for WCAG AA (ADR-033)
    // OpenCode mutedForeground #9f9f9f → adjusted for WCAG AA (ADR-033)
    // OpenCode success #7f9f7f → adjusted for WCAG AA (ADR-033)
    // OpenCode danger #cc9393 → adjusted for WCAG AA (ADR-033)
    // OpenCode info #dfaf8f → adjusted for WCAG AA (ADR-033)
    background: "#3f3f3f",
    card: "#4f4f4f",
    border: "#9f9f9f",
    foreground: "#dcdccc",
    mutedForeground: "#c0c0c0",
    primary: "#8cd0d3",
    success: "#b3c6b3",
    warning: "#f0dfaf",
    danger: "#deb9b9",
    info: "#e2b89b",
    accent: "#93e0e3",
    chart: ["#8cd0d3", "#b3c6b3", "#f0dfaf", "#cc9393", "#dfaf8f"],
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

/**
 * Text weight (ADR-095). A mono UI is thin by default and hard to read for long stretches, so this
 * is a first-class axis rather than a per-component decision: one setting drives body text and every
 * heading/strong element through two CSS variables, and the default is deliberately bold.
 */
export const TEXT_WEIGHTS = [
  { id: "regular", label: "Regular", body: "400", strong: "600" },
  { id: "medium", label: "Medium", body: "450", strong: "650" },
  { id: "bold", label: "Bold", body: "500", strong: "700" },
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
  /** ADR-095: body + heading weight, chosen by the user. */
  textWeight: z.enum(TEXT_WEIGHTS.map((w) => w.id) as [string, ...string[]]),
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
  textWeight: "bold",
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
    "data-text-weight": overrides.textWeight,
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

/**
 * A user accent is a UI choice, not a guaranteed data-viz colour. Move it toward whichever
 * extreme increases contrast before using it as the first chart series (ADR-098).
 */
function chartAccent(hex: string, palette: ThemePreset): string {
  const surfaces = [palette.background, palette.card];
  const clears = (candidate: string) =>
    surfaces.every((surface) => contrastRatio(candidate, surface) >= 3);
  if (clears(hex)) return hex;

  const targets =
    luminanceOfHex(palette.background) < 0.5 ? ["#ffffff", "#000000"] : ["#000000", "#ffffff"];
  for (const target of targets) {
    for (let amount = 0.05; amount <= 1.0001; amount += 0.05) {
      const candidate = mixSrgb(hex, target, amount);
      if (clears(candidate)) return candidate;
    }
  }
  return hex;
}

export function accentCssVars(overrides: ThemeOverrides, osDark: boolean): Record<string, string> {
  const hex = overrides.accent;
  if (!hex) return {};
  const palette = themes[resolveTheme(overrides, osDark).theme];
  const chart = derivedTokens(palette).chart;
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
    // Keep the accent as series one, but retain the palette's other data colours. Mixing every
    // series toward the background (the old behaviour) made them indistinguishable and often
    // failed the 3:1 chart threshold, especially with a light accent on Paper.
    "--chart-1": chartAccent(hex, palette),
    "--chart-2": chart[1],
    "--chart-3": chart[2],
    "--chart-4": chart[3],
    "--chart-5": chart[4],
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
    // globals.css: --chart-1..5: primary, success, warning, destructive, info — unless the theme
    // carries a dedicated chart palette (ADR-098: charts need 3:1, text needs 4.5:1).
    chart: theme.chart ?? [theme.primary, theme.success, theme.warning, theme.danger, theme.info],
  };
}
