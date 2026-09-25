"use client";

import { useEffect, useState } from "react";

/**
 * `window.matchMedia` as a boolean, SSR-safe.
 *
 * The shell needs the viewport to choose between the desktop sidebar cycle (ADR-028) and the
 * off-canvas mobile drawer: neither is a pure-CSS decision, because both are driven by React state
 * (`data-overlay`, `data-drawer`). Returns `false` on the server and on the first client paint, so
 * the markup is identical for both, then settles on the real value — no hydration mismatch.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);

  return matches;
}

/** The app's phone/tablet breakpoint: below this the sidebar is a drawer, not a column. */
export const MOBILE_QUERY = "(max-width: 47.999rem)";
