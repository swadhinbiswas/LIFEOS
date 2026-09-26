import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";

import { auth } from "./index";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

/**
 * The shared session read path for server-rendered pages and actions (ADR-026). Pages call this
 * rather than the proxy's cookie heuristic, so the real check is always the gate. Route handlers
 * that need a mutation-specific check may call Better Auth directly.
 *
 * **A session can outlive its user, and the gap is not theoretical.** Better Auth keeps sessions in
 * secondary storage — Upstash Redis here (ADR-037) — and that store is *not* scoped to a database.
 * So pointing `DATABASE_URL` at a different one (a fresh Turso database, a restored dump, another
 * developer's machine) leaves the cookie resolving perfectly well to a user id that has no row in
 * the connected `users` table. Nothing is wrong with the session and nothing is wrong with the
 * schema; the two have simply diverged.
 *
 * Without the check below, that state presents as a wall of raw `SQLITE_CONSTRAINT: FOREIGN KEY
 * constraint failed` dumps with the full statement and bound parameters, one per write, as 500s —
 * from a settings toggle, a board insert, anything. The user is told nothing useful and the log
 * blames the database. Here it presents as what it is: signed out. Every page already redirects to
 * `/sign-in` when this returns null, so one lookup buys a clean re-auth instead of a stack trace.
 *
 * The stale session is left in Redis rather than deleted. Clearing it needs a write from what is
 * otherwise a read path, and it expires on its own TTL; signing in again replaces it.
 *
 * `cache()` is request-scoped in React Server Components: a layout and its page can ask for the
 * same session without paying two secondary-storage lookups. It does not create a process-global
 * user cache; outside a React request dispatcher React simply calls the function normally.
 */
export const getServerSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;

  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return row ? session : null;
});
