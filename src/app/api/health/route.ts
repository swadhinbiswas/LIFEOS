import { sql } from "drizzle-orm";

import { isCloudDb } from "@/env";
import { db } from "@/server/db";
import { driftMessage, migrationDrift } from "@/server/db/migrations";

/**
 * Liveness/readiness probe (spec §7.1 observability). It touches the database with the cheapest
 * possible query so a probe reflects the thing that actually breaks, and reports which database
 * backend is in use without leaking a connection string.
 *
 * It also reports **migration drift** (ADR-113), because `select 1` succeeds against a database that
 * is three migrations behind — and that database throws `no such table` on the first page that
 * touches a newer table. A probe that only asked "is the socket open" called a broken deployment
 * healthy. An unapplied migration is reported as *not ready* so a deploy that forgot to migrate
 * fails here instead of serving 500s.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    await db.run(sql`select 1`);
  } catch {
    // Unreachable is the one failure that is unambiguous; nothing else is worth guessing at.
    return Response.json({ ok: false, service: "lifeos" }, { status: 503 });
  }

  const drift = await migrationDrift();
  const behind = driftMessage(drift);

  return Response.json(
    {
      ok: behind === null,
      service: "lifeos",
      database: isCloudDb ? "remote" : "file",
      migrations: {
        // `expected` comes from the drizzle journal. A deployment that ships no ./drizzle reports
        // `unknown: true` rather than a confident 0, so "verified current" is distinguishable from
        // "could not check" — it was built from the current schema, not migrated onto an old one.
        expected: drift.expected,
        applied: drift.applied,
        pending: drift.pending,
        unknown: drift.unknown,
        ...(drift.latest === null ? {} : { latest: drift.latest }),
        ...(drift.orphans.length === 0 ? {} : { orphans: drift.orphans }),
      },
      ...(behind === null ? {} : { reason: behind }),
      time: new Date().toISOString(),
    },
    { status: behind === null ? 200 : 503 },
  );
}
