import { dayKeyInTimeZone } from "@/lib/timezone";
import { apiContext, scopeAllows } from "@/server/api/v1/context";
import { badRequest, forbidden, rateLimited, unauthorized } from "@/server/api/v1/http";
import { withinRateLimit } from "@/server/api/v1/support";
import { getCalendar } from "@/server/calendar";
import { toIcs } from "@/server/calendar/ics";
import { shiftDay } from "@/server/habits/streak";
import { getTimeZone } from "@/server/settings";

/**
 * `GET /api/v1/export?format=ics` (spec §9.3): every dated item as an iCalendar file. Authenticated
 * with the API key in the header, never in the URL, so a calendar import is a deliberate download
 * from a trusted client — no secret ever has to travel in a query string (ADR-090).
 */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const context = await apiContext(request);
  if (!context) return unauthorized();
  if (!scopeAllows(context.scopes, "read:*")) return forbidden();
  if (!(await withinRateLimit(context.actor))) return rateLimited();

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "ics";
  if (format !== "ics") return badRequest("only format=ics is supported here");

  const now = new Date();
  const timeZone = await getTimeZone(context.userId);
  const today = dayKeyInTimeZone(now, timeZone);
  const events = await getCalendar(
    context.userId,
    { from: shiftDay(today, -180), to: shiftDay(today, 365) },
    timeZone,
  );

  return new Response(toIcs(events, { now, origin: url.origin, name: "LifeOS" }), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'attachment; filename="lifeos.ics"',
    },
  });
}
