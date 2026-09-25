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

/**
 * A local SQLite file is guarded by a file lock, and libSQL surfaces the collision as
 * `SQLITE_BUSY: database is locked` — immediately, with no retry. Next serves requests
 * concurrently, so a read that merely overlaps a write must not fail (ADR-102). Two pragmas fix
 * that, and they are per-connection statements queued before `drizzle()` below, so every later
 * query sees them:
 *
 * - `journal_mode = WAL` lets readers run while a writer holds the lock. This one is a *persistent*
 *   database property: once set it applies to every connection, forever.
 * - `busy_timeout` makes two writers queue instead of the loser erroring on first contact.
 *
 * A remote database (Turso) has no file lock and ignores unknown pragmas, so a failure here is
 * swallowed rather than fatal at import time — a local file that is momentarily busy just keeps
 * the previous mode until a later process applies it.
 */
const applyLocalPragmas = async (): Promise<void> => {
  for (const statement of ["PRAGMA journal_mode = WAL", "PRAGMA busy_timeout = 10000"]) {
    try {
      await client.execute(statement);
    } catch {
      // Contended file, or a remote database that does not know the pragma. Neither is fatal.
    }
  }
};
void applyLocalPragmas();

export const db = drizzle(client, { schema });

export { schema };
