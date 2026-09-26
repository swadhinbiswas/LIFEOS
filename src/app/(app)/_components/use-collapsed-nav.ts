"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * Which nav sections are folded (ADR-130).
 *
 * The sidebar is 25+ destinations in six sections, and on a short window it scrolls — which means
 * reaching "Prep" means scrolling past Inbox, Finance and Health to get there. Folding a section is
 * the difference between a list you scan and a list you traverse.
 *
 * **Read through `useSyncExternalStore`, not an effect.** The obvious version is `useState` plus a
 * `useEffect` that reads `localStorage` after mount, and that is wrong twice over: `localStorage`
 * does not exist on the server, so the first client render would disagree with the server's and
 * React would report a hydration mismatch; and setting state synchronously inside an effect is the
 * cascading-render case the React compiler lint exists to catch. This hook has no effect at all. The
 * server snapshot is "nothing folded" and the client snapshot is what is stored, which is exactly
 * the right story: a first-time visitor gets every section open.
 *
 * The snapshot is a **string**, not a parsed array, because `useSyncExternalStore` compares snapshots
 * by identity — returning a fresh array on every call would re-render forever.
 */
const STORAGE_KEY = "lifeos.nav.collapsed";
const SERVER_SNAPSHOT = "[]";

/** Same-tab listeners. `storage` only fires in *other* tabs, so folding needs its own signal. */
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab folding a section should not leave this one showing a stale list.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? SERVER_SNAPSHOT;
  } catch {
    // Private mode, or a store the browser refuses. Folding still works for this session.
    return SERVER_SNAPSHOT;
  }
}

export function useCollapsedSections(): {
  collapsed: ReadonlySet<string>;
  toggle: (id: string) => void;
} {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);

  const collapsed = useMemo<ReadonlySet<string>>(() => {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set();
      return new Set(parsed.filter((id): id is string => typeof id === "string"));
    } catch {
      return new Set();
    }
  }, [raw]);

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(collapsed);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // Nothing to do: the store is unavailable, so the change lives only in this session.
      }
      emit();
    },
    [collapsed],
  );

  return { collapsed, toggle };
}
