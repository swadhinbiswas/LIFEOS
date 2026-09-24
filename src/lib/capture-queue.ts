/**
 * Offline capture queue (MVP #29, ADR-051). Captures made while the browser is offline are held
 * in `localStorage` and replayed through the normal `captureTaskAction` when a connection
 * returns. The capture path is append-only, so replay creates the card exactly once — which is
 * why a queue is safe here where a general mutation queue would need conflict resolution.
 *
 * The module is storage-only and pure: the flush takes a sender function, so the logic is
 * unit-testable without a network or a React tree. A module-level subscription feeds React via
 * `useSyncExternalStore`.
 */

export interface QueuedCapture {
  id: string;
  text: string;
  columnName: string;
  queuedAt: string;
}

const KEY = "lifeos.capture-queue";
const listeners = new Set<() => void>();
let cache: QueuedCapture[] | null = null;
let flushing = false;

function read(): QueuedCapture[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedCapture[]) : [];
  } catch {
    return [];
  }
}

function write(items: QueuedCapture[]): void {
  cache = items;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* storage blocked or full — the in-memory cache still serves this session */
    }
  }
  for (const listener of listeners) listener();
}

export function getQueue(): QueuedCapture[] {
  if (cache === null) cache = read();
  return cache;
}

/** What `useSyncExternalStore` reads; a number keeps the snapshot stable across renders. */
export function getPendingCount(): number {
  return getQueue().length;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function enqueue(input: { text: string; columnName: string }): void {
  write([
    ...getQueue(),
    {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      text: input.text,
      columnName: input.columnName,
      queuedAt: new Date().toISOString(),
    },
  ]);
}

export function removeQueued(id: string): void {
  write(getQueue().filter((item) => item.id !== id));
}

/** Discard everything — exposed for tests and future "clear queue" UI. */
export function clearQueue(): void {
  write([]);
}

/**
 * Replay the queue oldest-first through `send`, stopping at the first failure so the rest survive
 * for the next attempt. Returns how many went. Re-entrant calls are ignored.
 */
export async function flushCaptureQueue(
  send: (item: QueuedCapture) => Promise<boolean>,
): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (const item of getQueue()) {
      const ok = await send(item);
      if (!ok) break;
      removeQueued(item.id);
      sent += 1;
    }
  } finally {
    flushing = false;
  }
  return sent;
}
