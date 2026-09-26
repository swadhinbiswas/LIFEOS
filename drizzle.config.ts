import { defineConfig } from "drizzle-kit";

import { env } from "./src/env";

/**
 * Migrations live in ./drizzle and are committed (they are the schema's history).
 * DATABASE_URL comes from the single env contract (ADR-027) — env.ts loads .env itself,
 * so this works under `drizzle-kit generate|migrate` as well as under Next.js.
 *
 * `authToken` is passed for the same reason `src/server/db/index.ts` passes it: Turso's token is
 * a *separate* secret from the database URL, which is what keeps the URL safe to print, diff and
 * put in a runbook. Without this line `db:migrate` would resolve the host and then be rejected
 * with an auth error, so the split form would work at runtime and fail at exactly the moment
 * somebody tried to create the schema. `undefined` keeps a local `file:` database working.
 */
export default defineConfig({
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: env.DATABASE_URL,
    ...(env.TURSO_AUTH_TOKEN ? { authToken: env.TURSO_AUTH_TOKEN } : {}),
  },
});
