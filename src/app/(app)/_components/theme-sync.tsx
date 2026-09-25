"use client";

import { useEffect, useRef } from "react";

import type { ThemeOverrides } from "@/config/themes";
import { useThemeStore } from "@/lib/theme-store";
import { persistTheme } from "@/server/settings/actions";

/**
 * Order-independent serialization. A stored row/cookie can come from an older shape or a different
 * write order, so a plain `JSON.stringify` of the same values can differ — the dedupe below then
 * missed and re-persisted the theme on **every** mount, adding a settings write to every navigation.
 */
const stable = (overrides: ThemeOverrides): string =>
  JSON.stringify(
    Object.fromEntries(Object.entries(overrides).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
  );

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
  const lastPersisted = useRef<string>(stable(fromDb ?? initial));

  useEffect(() => {
    replace(fromDb ?? initial);
  }, [fromDb, initial, replace]);

  useEffect(() => {
    const serialized = stable(overrides);
    // The value this load hydrated from, and the value we last wrote. The persist effect sees the
    // store's *pre-hydration* value on its first run (React runs it before the replace() re-render
    // lands), which is what used to write a settings row on every mount. Anything that matches what
    // the server already sent us is therefore not a change; only a real customizer edit differs.
    if (serialized === stable(fromDb ?? initial) || serialized === lastPersisted.current) return;
    lastPersisted.current = serialized;
    const timer = setTimeout(() => {
      void persistTheme(overrides)
        .then((result) => {
          if (!result.ok) lastPersisted.current = "";
        })
        .catch(() => {
          // Let the next render retry rather than silently losing a theme change.
          lastPersisted.current = "";
        });
    }, 200);
    return () => clearTimeout(timer);
  }, [overrides, fromDb, initial]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => reapply();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [reapply]);

  return null;
}
