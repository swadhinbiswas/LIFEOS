import { env } from "@/env";
import { purgeExpiredAccounts } from "@/server/data/account";

/**
 * Account-deletion purge (spec §10, ADR-083): removes accounts whose 7-day grace period has passed.
 * `CRON_SECRET`-guarded like the other crons; without the secret the route does not exist (404).
 */
export async function GET(request: Request): Promise<Response> {
  if (!env.CRON_SECRET) return new Response(null, { status: 404 });
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const purged = await purgeExpiredAccounts(new Date());
  return Response.json({ purged });
}
