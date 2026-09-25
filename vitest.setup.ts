import "@testing-library/jest-dom/vitest";

// Unit tests are hermetic: force the in-memory Redis stub (ADR-021) before `@/env` is imported.
// `process.loadEnvFile()` never overrides variables already set, so a developer's real Upstash
// database in `.env` is neither read nor written by `pnpm test` — results never depend on it.
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";
