import { env } from "@/env";
import { runProactive } from "@/server/ai/proactive";

/**
 * Proactive copilot cron (spec §8, ADR-078). A scheduler (Vercel Cron / QStash) calls this with
 * `Authorization: Bearer $CRON_SECRET`; without the secret the route does not exist (404). It only
 * touches users who opted in, and delivery is deduped per day, so a retry is a no-op.
 */
export async function GET(request: Request): Promise<Response> {
  if (!env.CRON_SECRET) return new Response(null, { status: 404 });
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const results = await runProactive(new Date());
  return Response.json({
    processed: results.length,
    delivered: results.filter((result) => result.delivered).length,
    results,
  });
}
