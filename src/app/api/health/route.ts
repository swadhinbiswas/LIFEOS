import { sql } from "drizzle-orm";

import { isCloudDb } from "@/env";
import { db } from "@/server/db";

/**
 * Liveness/readiness probe (spec §7.1 observability). It touches the database with the cheapest
 * possible query so a probe reflects the thing that actually breaks, and reports which database
 * backend is in use without leaking a connection string.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    await db.run(sql`select 1`);
    return Response.json({
      ok: true,
      service: "lifeos",
      database: isCloudDb ? "remote" : "file",
      time: new Date().toISOString(),
    });
  } catch {
    return Response.json({ ok: false, service: "lifeos" }, { status: 503 });
  }
}
