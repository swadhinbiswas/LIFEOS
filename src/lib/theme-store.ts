"use client";

import { create } from "zustand";

import {
  ACCENT_CSS_VARS,
  accentCssVars,
  DEFAULT_THEME,
  themeAttrs,
  type ThemeOverrides,
} from "@/config/themes";

/**
 * Live theme store (ADR-024, spec §3.3/§7.1): the customizer writes here and the `data-*`
 * attributes on `<html>` update immediately — no reload.
 *
 * Persistence is deliberately NOT here: it lives behind a `"use server"` boundary
 * (`src/server/settings/actions.ts`) and importing it would drag server code into any unit
 * test of this module. The shell's `ThemeSync` bridges store → server.
 */

function prefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Applies overrides to `<html>` exactly like the root layout does for SSR (ADR-024). */
export function applyTheme(overrides: ThemeOverrides): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const osDark = prefersDark();

  for (const [name, value] of Object.entries(themeAttrs(overrides, osDark))) {
    root.setAttribute(name, value);
  }
  for (const name of ACCENT_CSS_VARS) root.style.removeProperty(name);
  for (const [name, value] of Object.entries(accentCssVars(overrides, osDark))) {
    root.style.setProperty(name, value);
  }
}

interface ThemeState {
  overrides: ThemeOverrides;
  /** Set one customizer axis; re-applies to `<html>` immediately. */
  set: <K extends keyof ThemeOverrides>(key: K, value: ThemeOverrides[K]) => void;
  /** Replace the whole set (hydration from cookie/DB). */
  replace: (overrides: ThemeOverrides) => void;
  /** Re-apply the current set (OS colour-scheme change while `colorMode: "system"`). */
  reapply: () => void;
}

export const useThemeStore = create<ThemeState>()((setState, getState) => ({
  overrides: DEFAULT_THEME,
  set: (key, value) => {
    const overrides = { ...getState().overrides, [key]: value };
    setState({ overrides });
    applyTheme(overrides);
  },
  replace: (overrides) => {
    setState({ overrides });
    applyTheme(overrides);
  },
  reapply: () => applyTheme(getState().overrides),
}));
