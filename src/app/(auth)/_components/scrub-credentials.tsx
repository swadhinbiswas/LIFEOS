"use client";

import { useEffect } from "react";

/**
 * Security net for credentials in the address bar. If a URL ever arrives carrying sensitive query
 * parameters (an older build, a copied link, a native submit before hydration), this strips them
 * from the address bar **and the history entry** immediately, so the next reload or submit cannot
 * inherit them. Uses `replaceState`, so there is no navigation and no new history entry.
 *
 * Deliberately narrow: it removes the *credentials* a form could leak, and leaves the one-time
 * `token` a password-reset / verification link is built on.
 */
const SENSITIVE = ["password", "email"];

export function ScrubCredentials() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const keys = [...params.keys()].filter((key) => SENSITIVE.includes(key.toLowerCase()));
    if (keys.length === 0) return;

    for (const key of keys) params.delete(key);
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query === "" ? "" : `?${query}`}`,
    );
  }, []);

  return null;
}
