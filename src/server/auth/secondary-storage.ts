import type { BetterAuthOptions } from "better-auth";

import { type RedisClient, redis } from "@/server/redis/client";

/**
 * Better Auth's cache/counter layer over the ADR-021 client (ADR-037):
 *
 * - always wired (Upstash or in-memory stub) so every environment runs one code path;
 * - the database stays the source of truth (ADR-030) — this layer only ever accelerates
 *   (`storeSessionInDatabase`/`storeInDatabase` are set unconditionally in the auth config);
 * - **explicit fail-open** (the ADR-014 pattern): transport errors degrade to "no cache"
 *   and, for counters, to a count of `1` — Better Auth allows a request when
 *   `increment <= max`, so a dead backend never bricks sign-in. The availability-vs-
 *   strictness tradeoff is recorded in ADR-037 and gets its docs/SECURITY.md paragraph
 *   at Phase 9.
 *
 * Exported as a builder so tests can drive it with a fake `RedisClient` without network.
 */
export type SecondaryStorage = NonNullable<BetterAuthOptions["secondaryStorage"]>;

export function buildSecondaryStorage(client: RedisClient): SecondaryStorage {
  return {
    async get(key) {
      try {
        return await client.get(key);
      } catch {
        return null; // cache miss → SQL serves
      }
    },
    async getAndDelete(key) {
      try {
        return await client.take(key);
      } catch {
        return null;
      }
    },
    async increment(key, ttl) {
      try {
        return await client.increment(key, ttl);
      } catch {
        return 1; // fail-open: below any max → request proceeds (ADR-037)
      }
    },
    async set(key, value, ttl) {
      try {
        await client.set(key, value, ttl);
      } catch {
        /* fail-open: skipped cache write */
      }
    },
    async delete(key) {
      try {
        await client.delete(key);
      } catch {
        /* fail-open: skipped cache delete */
      }
    },
  };
}

export const secondaryStorage = buildSecondaryStorage(redis);
