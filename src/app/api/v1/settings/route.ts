import { z } from "zod";

import { apiContext, scopeAllows } from "@/server/api/v1/context";
import {
  badRequest,
  forbidden,
  jsonResponse,
  rateLimited,
  unauthorized,
} from "@/server/api/v1/http";
import { withinRateLimit } from "@/server/api/v1/support";
import { getRegionalSettings, setTimeZone, setWeekStart } from "@/server/settings";

/**
 * `/api/v1/settings` (spec §9.1, ADR-070): the regional settings (timezone + week start) as a
 * singleton resource — read with `read:*`, written with `write:life`.
 */

const patchBody = z.object({
  timeZone: z.string().trim().min(1).max(64).optional(),
  weekStart: z.enum(["mon", "sun"]).optional(),
});

export async function GET(request: Request): Promise<Response> {
  const context = await apiContext(request);
  if (!context) return unauthorized();
  if (!scopeAllows(context.scopes, "read:*")) return forbidden();
  if (!(await withinRateLimit(context.actor))) return rateLimited();

  return jsonResponse({ data: await getRegionalSettings(context.userId) });
}

export async function PATCH(request: Request): Promise<Response> {
  const context = await apiContext(request);
  if (!context) return unauthorized();
  if (!scopeAllows(context.scopes, "write:life")) return forbidden();
  if (!(await withinRateLimit(context.actor))) return rateLimited();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("body must be JSON");
  }
  const parsed = patchBody.safeParse(body);
  if (!parsed.success) return badRequest("invalid body", parsed.error.issues);
  if (Object.keys(parsed.data).length === 0) return badRequest("nothing to update");

  if (parsed.data.timeZone !== undefined) await setTimeZone(context.userId, parsed.data.timeZone);
  if (parsed.data.weekStart !== undefined)
    await setWeekStart(context.userId, parsed.data.weekStart);

  return jsonResponse({ data: await getRegionalSettings(context.userId) });
}
