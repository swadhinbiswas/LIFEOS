import { env } from "@/env";
import {
  ACTIVITY_REFRESH,
  isDue,
  listDueActivityConnections,
  syncWakaTime,
} from "@/server/activity/wakatime";
import { getTimeZone } from "@/server/settings";

/**
 * WakaTime freshness cron (ADR-129).
 *
 * Before this, the only way to refresh a connection was the button on the settings page, so the
 * chart on `/settings/activity` showed whatever the last manual sync happened to have fetched. A
 * tracker of your own coding time that is a day stale because nobody remembered a button is not
 * tracking anything.
 *
 * Same contract as `/api/cron/proactive` and `/api/cron/webhooks` (ADR-078/079): no `CRON_SECRET`
 * means the route does not exist, and the bearer header is checked before anything is read. Call it
 * hourly — `0 * * * *` — and the throttle in the service means a louder schedule costs nothing extra.
 *
 * The response never contains a key, a token or a provider payload: per account it reports whether
 * the sync ran, and the already-trimmed error string the service produces for a human.
 */
export async function GET(request: Request): Promise<Response> {
  if (!env.CRON_SECRET) return new Response(null, { status: 404 });
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const connections = await listDueActivityConnections();

  const results: Array<{ userId: string; synced: boolean; reason: string; days?: number }> = [];

  // Sequential on purpose. These are outbound calls to one provider against real people's accounts,
  // and firing them all at once is how a refresh job gets a provider to rate-limit the whole
  // install. A handful of accounts costs a few seconds; correctness beats speed for a cron.
  for (const connection of connections) {
    // Throttled per account, not globally: one account syncing twenty minutes ago must not hold
    // back the nineteen that have never run.
    if (!isDue(connection.lastSyncedAt, now)) {
      results.push({ userId: connection.userId, synced: false, reason: "not due yet" });
      continue;
    }
    try {
      // Each account's own timezone, because "today" is a local day and a UTC assumption would put
      // the last few hours of a Berlin evening in tomorrow's bucket.
      const timeZone = await getTimeZone(connection.userId);
      const result = await syncWakaTime(
        connection.userId,
        ACTIVITY_REFRESH.windowDays,
        now,
        timeZone,
      );
      results.push({
        userId: connection.userId,
        synced: result.ok,
        reason: result.ok ? `synced ${result.days} day(s)` : (result.error ?? "sync failed"),
        ...(result.ok ? { days: result.days } : {}),
      });
    } catch (error) {
      // One broken account must not abort the run for the rest. `syncWakaTime` already records its
      // own failures on the connection; this catches the ones it cannot, such as the database being
      // briefly unavailable, and moves on.
      console.error("[cron/activity] sync threw", connection.userId, error);
      results.push({ userId: connection.userId, synced: false, reason: "unexpected error" });
    }
  }

  return Response.json({
    connections: connections.length,
    synced: results.filter((result) => result.synced).length,
    skipped: results.filter((result) => !result.synced).length,
    results,
  });
}
