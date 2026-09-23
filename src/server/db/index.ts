import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { env } from "@/env";
import * as schema from "./schema";

/**
 * Single libSQL client + Drizzle instance (ADR-020): `file:.data/lifeos.db` in dev/test,
 * `libsql://…` (+ token) for Turso. The schema object feeds `db.query` and Better Auth's
 * adapter (ADR-036). Tenant isolation is a service-layer rule: every query filters the
 * authenticated owner (spec line 350) — never reach around it with raw SQL.
 */
const client = createClient({
  url: env.DATABASE_URL,
  ...(env.TURSO_AUTH_TOKEN ? { authToken: env.TURSO_AUTH_TOKEN } : {}),
});

export const db = drizzle(client, { schema });

export { schema };
