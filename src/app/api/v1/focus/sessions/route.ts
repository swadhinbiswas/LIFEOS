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
import { listSessions, startSession } from "@/server/focus";

/**
 * `/api/v1/focus/sessions` (spec §9.1, ADR-070): list sessions or start one. A session is a row
 * with `ended_at IS NULL`, so starting stops any running session first (the service does that).
 */

const startBody = z.object({
  plannedMin: z.number().int().min(1).max(1_440).nullable().optional(),
  cardId: z.string().min(1).max(64).nullable().optional(),
  kind: z.enum(["focus", "break"]).optional(),
});

const serialize = (row: Awaited<ReturnType<typeof listSessions>>[number]) => ({
  id: row.id,
  kind: row.kind,
  started_at: new Date(row.started_at).toISOString(),
  ended_at: row.ended_at ? new Date(row.ended_at).toISOString() : null,
  planned_min: row.planned_min,
  completed: row.completed,
});

export async function GET(request: Request): Promise<Response> {
  const context = await apiContext(request);
  if (!context) return unauthorized();
  if (!scopeAllows(context.scopes, "read:*")) return forbidden();
  if (!(await withinRateLimit(context.actor))) return rateLimited();

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20) || 20, 1), 100);
  const rows = await listSessions(context.userId, limit);
  return jsonResponse({ data: rows.map(serialize), next_cursor: null });
}

export async function POST(request: Request): Promise<Response> {
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
  const parsed = startBody.safeParse(body ?? {});
  if (!parsed.success) return badRequest("invalid body", parsed.error.issues);

  const row = await startSession(context.userId, parsed.data);
  return jsonResponse({ data: serialize(row) }, { status: 201 });
}
