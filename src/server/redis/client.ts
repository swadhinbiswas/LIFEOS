import { Redis } from "@upstash/redis";

import { env, hasUpstash } from "@/env";

/**
 * ADR-021: the real `@upstash/redis` client when UPSTASH_REDIS_REST_URL/TOKEN are set,
 * an in-memory Map-backed stub otherwise — one interface, so dev, tests and prod run the
 * same code path and differ only in durability. Upstash is never a source of truth
 * (spec §7.1); it accelerates Better Auth's secondary layer (ADR-037) and, from Phase 5,
 * the app-level rate limiter (ADR-014).
 *
 * Transport errors are deliberately NOT swallowed here: fail-open is an explicit policy
 * of each caller (ADR-014/037), so failures stay visible to the layer that decides.
 */

/** Lua: INCR with EXPIRE applied only on creation — an atomic fixed window (BA `increment`). */
export const INCREMENT_TTL_SCRIPT = `local v = redis.call("INCR", KEYS[1])
if v == 1 then redis.call("EXPIRE", KEYS[1], ARGV[1]) end
return v`;

/** Lua: GET + DEL in one step, so a single-use value cannot be read twice (BA `getAndDelete`). */
export const TAKE_SCRIPT = `local v = redis.call("GET", KEYS[1])
if v then redis.call("DEL", KEYS[1]) end
return v`;

/** The operations LifeOS uses from Redis today; both backends implement exactly this. */
export interface RedisClient {
  get(key: string): Promise<unknown>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  /** Atomic INCR; TTL applied only when the key is created. Returns the post-increment count. */
  increment(key: string, ttlSeconds: number): Promise<number>;
  /** Atomic GET+DEL; returns the value or null when absent/failed to exist. */
  take(key: string): Promise<unknown>;
}

class UpstashClient implements RedisClient {
  constructor(private readonly redis: Redis) {}

  async get(key: string): Promise<unknown> {
    return await this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await this.redis.set(key, value, ttlSeconds ? { ex: ttlSeconds } : undefined);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.redis.eval(INCREMENT_TTL_SCRIPT, [key], [String(ttlSeconds)]);
    return Number(count);
  }

  async take(key: string): Promise<unknown> {
    return await this.redis.eval(TAKE_SCRIPT, [key], []);
  }
}

interface Entry {
  value: string;
  expiresAt: number; // epoch ms; Infinity = no TTL
}

/** Dev/test fallback: same semantics, single process, no durability (ADR-021). */
class MemoryClient implements RedisClient {
  private readonly store = new Map<string, Entry>();

  private live(key: string): Entry | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  async get(key: string): Promise<unknown> {
    return this.live(key)?.value ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : Number.POSITIVE_INFINITY,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const entry = this.live(key);
    if (!entry) {
      this.store.set(key, { value: "1", expiresAt: Date.now() + ttlSeconds * 1000 });
      return 1;
    }
    const next = Number(entry.value) + 1;
    entry.value = String(next);
    return next;
  }

  async take(key: string): Promise<unknown> {
    const entry = this.live(key);
    if (!entry) return null;
    this.store.delete(key);
    return entry.value;
  }
}

export const redis: RedisClient =
  hasUpstash && env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new UpstashClient(
        new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN }),
      )
    : new MemoryClient();

console.log(hasUpstash ? "[redis] upstash (REST)" : "[redis] in-memory stub (dev, adr-021)");
