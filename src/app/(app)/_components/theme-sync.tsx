"use client";

import { useEffect, useRef } from "react";

import type { ThemeOverrides } from "@/config/themes";
import { useThemeStore } from "@/lib/theme-store";
import { persistTheme } from "@/server/settings/actions";

/**
 * Bridges the live theme store to persistence (ADR-024):
 * - hydrates once from the signed-in user's DB row, falling back to the first-paint cookie;
 * - writes later changes back through the settings service's Server-Action adapter (cookie
 *   always, DB row only when signed in), debounced so a colour-picker drag is one write;
 * - re-applies when the OS colour scheme flips while `colorMode: "system"`.
 *
 * Renders nothing. Mounted by the (app) layout.
 */
export function ThemeSync({
  initial,
  fromDb,
}: {
  initial: ThemeOverrides;
  fromDb: ThemeOverrides | null;
}) {
  const overrides = useThemeStore((state) => state.overrides);
  const replace = useThemeStore((state) => state.replace);
  const reapply = useThemeStore((state) => state.reapply);
  const lastPersisted = useRef<string>(JSON.stringify(fromDb ?? initial));

  useEffect(() => {
    replace(fromDb ?? initial);
  }, [fromDb, initial, replace]);

  useEffect(() => {
    const serialized = JSON.stringify(overrides);
    if (serialized === lastPersisted.current) return;
    lastPersisted.current = serialized;
    const timer = setTimeout(() => void persistTheme(overrides), 200);
    return () => clearTimeout(timer);
  }, [overrides]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => reapply();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [reapply]);

  return null;
}
