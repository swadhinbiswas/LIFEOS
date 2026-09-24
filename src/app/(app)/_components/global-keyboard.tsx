"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { GOTO_TARGETS } from "@/config/shortcuts";
import { useThemeStore } from "@/lib/theme-store";

/** Focus the first element matching `selector`, if any (used by `n` and `/`). */
function focusFirst(selector: string): boolean {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return false;
  element.focus();
  if (element instanceof HTMLInputElement) element.select();
  return true;
}

/**
 * Global keyboard layer (spec §4.3): `g` then a letter navigates, `n` starts a new item in the
 * current context, `/` focuses the page search, `t` toggles light/dark. Typing in a field
 * disables all of it, and `?`/`[`/`Esc`/Ctrl+K stay with the shell.
 *
 * Every binding here is also in `config/shortcuts.ts`, so the cheat-sheet cannot drift.
 */
export function GlobalKeyboard() {
  const router = useRouter();
  const colorMode = useThemeStore((state) => state.overrides.colorMode);
  const setOverride = useThemeStore((state) => state.set);
  const [awaitingGoto, setAwaitingGoto] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (awaitingGoto) {
        setAwaitingGoto(false);
        const href = GOTO_TARGETS[event.key.toLowerCase()];
        if (href) {
          event.preventDefault();
          router.push(href);
        }
        return;
      }

      if (event.key === "g") {
        event.preventDefault();
        setAwaitingGoto(true);
        return;
      }
      if (event.key === "t") {
        event.preventDefault();
        setOverride("colorMode", colorMode === "dark" ? "light" : "dark");
        return;
      }
      if (event.key === "n") {
        if (focusFirst("[data-new-item]")) event.preventDefault();
        return;
      }
      if (event.key === "/") {
        if (focusFirst("[data-search]")) event.preventDefault();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [awaitingGoto, colorMode, router, setOverride]);

  return null;
}
