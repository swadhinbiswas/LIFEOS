import { redis } from "@/server/redis/client";

/**
 * Cross-cutting REST concerns (spec §9.1, ADR-063): an opaque keyset cursor, sparse fields, an
 * Idempotency-Key cache and a per-actor rate limit. The cursor is base64 so clients treat it as
 * opaque; the idempotency and rate-limit stores are the existing Redis (Upstash or the dev stub).
 * The idempotency cache is best-effort: a Redis outage must not turn a committed mutation into a
 * 500, so both cache operations fail open (ADR-099).
 */

export interface KeysetCursor {
  createdAt: string;
  id: string;
}

export const encodeCursor = (cursor: KeysetCursor): string =>
  Buffer.from(JSON.stringify(cursor)).toString("base64url");

/** Returns null for absent/invalid so the caller can answer 400 rather than silently paging. */
export function decodeCursor(raw: string | null): KeysetCursor | null | "invalid" {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString()) as KeysetCursor;
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") return "invalid";
    return parsed;
  } catch {
    return "invalid";
  }
}

export interface PageQuery {
  limit: number;
  cursor: KeysetCursor | null | "invalid";
}

export function pageQuery(url: URL, defaultLimit = 25, maxLimit = 100): PageQuery {
  const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), maxLimit)
    : defaultLimit;
  return { limit, cursor: decodeCursor(url.searchParams.get("cursor")) };
}

/** `?fields=id,title` — omitted means the full row. Unknown names are ignored, never invented. */
export function parseFields(raw: string | null): string[] | null {
  if (!raw) return null;
  return raw
    .split(",")
    .map((field) => field.trim())
    .filter((field) => field !== "");
}

export function pickFields<T extends Record<string, unknown>>(
  row: T,
  fields: string[] | null,
): Partial<T> {
  if (!fields) return row;
  const out: Record<string, unknown> = {};
  for (const field of fields) if (field in row) out[field] = row[field];
  return out as Partial<T>;
}

const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24;

/**
 * Replay a cached successful response for the same Idempotency-Key, otherwise run and cache it.
 * Only 2xx bodies are cached, so a failed attempt can be retried with the same key.
 */
export async function idempotent(
  userId: string,
  key: string,
  run: () => Promise<Response>,
): Promise<Response> {
  const storeKey = `idem:${userId}:${key}`;
  let cached: unknown = null;
  try {
    cached = await redis.get(storeKey);
  } catch {
    // The cache is an optimisation, not the mutation's source of truth. If Redis is unavailable,
    // run the request rather than turning a cache outage into a 500 before the mutation happens.
    cached = null;
  }
  if (typeof cached === "string") {
    return new Response(cached, {
      status: 200,
      headers: { "content-type": "application/json", "idempotent-replay": "true" },
    });
  }

  const response = await run();
  if (response.ok) {
    const body = await response.clone().text();
    try {
      await redis.set(storeKey, body, IDEMPOTENCY_TTL_SECONDS);
    } catch {
      // The mutation already committed. Never replace its real response with a cache-write error;
      // a retry may run again while Redis is down, which is the documented availability tradeoff.
    }
  }
  return response;
}

/**
 * Fixed-window per-actor limit (ADR-014). Fail-open on a Redis error: the API erroring because a
 * cache hiccuped would be worse than a briefly-unenforced limit.
 */
export async function withinRateLimit(
  actor: string,
  limit = 120,
  windowSeconds = 60,
): Promise<boolean> {
  try {
    const window = Math.floor(Date.now() / (windowSeconds * 1000));
    const count = await redis.increment(`rl:api:${actor}:${window}`, windowSeconds);
    return count <= limit;
  } catch {
    return true;
  }
}
