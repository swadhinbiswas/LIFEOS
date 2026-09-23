"use client";

import { useSyncExternalStore } from "react";

/**
 * Reactive read of the resolved color mode from <html data-mode> (ADR-024/034).
 * The attribute is the single source of truth after SSR + the no-FOUC script; a
 * MutationObserver keeps client components in sync when the theme store rewrites it.
 */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-mode"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): string | null {
  return document.documentElement.getAttribute("data-mode");
}

/** Matches SSR (which assumes dark for system mode, ADR-024). */
function getServerSnapshot(): string {
  return "dark";
}

export function useColorMode(): "light" | "dark" {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return mode === "light" ? "light" : "dark";
}
