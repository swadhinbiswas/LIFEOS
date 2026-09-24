import { env } from "@/env";
import { retryDueDeliveries } from "@/server/webhooks";

/**
 * Webhook retry cron (spec §9.3, ADR-069). Due deliveries are re-attempted on their exponential
 * backoff; a scheduler (Vercel Cron / QStash) calls this with `Authorization: Bearer $CRON_SECRET`.
 * Without the secret the route does not exist (404), so nothing is exposed by default — the UI also
 * drains a user's due retries opportunistically, which keeps dev and small installs self-healing.
 */
export async function GET(request: Request): Promise<Response> {
  if (!env.CRON_SECRET) return new Response(null, { status: 404 });
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const processed = await retryDueDeliveries(new Date());
  return Response.json({ processed });
}
