import { defineConfig } from "drizzle-kit";

import { env } from "./src/env";

/**
 * Migrations live in ./drizzle and are committed (they are the schema's history).
 * DATABASE_URL comes from the single env contract (ADR-027) — env.ts loads .env itself,
 * so this works under `drizzle-kit generate|migrate` as well as under Next.js.
 */
export default defineConfig({
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: { url: env.DATABASE_URL },
});
