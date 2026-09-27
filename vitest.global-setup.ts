/**
 * Vitest `globalSetup` — runs once in the main process, before any worker is forked.
 *
 * This exists because `setupFiles` cannot do this job. A `process.env` assignment made in
 * `vitest.setup.ts` is **not visible to the test module**: verified by setting a probe variable
 * there and reading it from a test, in both the default `jsdom` environment and the `node` one
 * several suites opt into — `undefined` in both cases. Vitest hands each test file its own
 * environment object, so the mutation lands somewhere the tests never look. That is worth knowing
 * on its own, because the two `UPSTASH_REDIS_REST_URL`/`_TOKEN` assignments that file has carried
 * as a hermeticity guarantee have therefore not been doing anything: a developer's real Upstash
 * database in `.env` was reachable from `pnpm test` despite the comment saying otherwise.
 *
 * `globalSetup` is the mechanism that does work, because workers inherit the parent's
 * `process.env` when they are forked, and `process.loadEnvFile()` — which `src/env.ts` calls —
 * never overrides a variable that is already present. An empty string therefore survives the load,
 * and `configuredEnv()` in `env.ts` treats empty as "not configured", so the key is absent by the
 * time the schema validates.
 */

/** Runs once before any worker forks. See the note above for why this is here. */
export function setup(): void {
  process.env.UPSTASH_REDIS_REST_URL = "";
  process.env.UPSTASH_REDIS_REST_TOKEN = "";

  // Turso, for the same reason and with more force (ADR-121). Forty-five suites set their own
  // `file:` DATABASE_URL in code, and `env.ts` *rejects* TURSO_AUTH_TOKEN alongside a `file:` URL.
  // With the real token present in `.env`, every one of those suites fails to even load its
  // database module. So pointing the app at a remote database has to leave `pnpm test` runnable —
  // and a unit test must never be able to reach a real remote database, whatever it forgets to pin.
  process.env.TURSO_AUTH_TOKEN = "";

  // The webhook delivery suite proves signing and retries against a real listener on 127.0.0.1,
  // which the SSRF guard (ADR-135) blocks by default. This is exactly the case the operator opt-out
  // exists for, and the guard's own tests cover the blocked path with an injected resolver.
  process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS = "true";
}
