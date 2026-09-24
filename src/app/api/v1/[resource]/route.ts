import { ZodError } from "zod";

import { apiContext, scopeAllows } from "@/server/api/v1/context";
import {
  badRequest,
  forbidden,
  jsonResponse,
  notFound,
  rateLimited,
  unauthorized,
} from "@/server/api/v1/http";
import { RESOURCES } from "@/server/api/v1/resources";
import {
  encodeCursor,
  idempotent,
  pageQuery,
  parseFields,
  pickFields,
  withinRateLimit,
} from "@/server/api/v1/support";

/**
 * `/api/v1/[resource]` (spec §9.1, ADR-070): one dynamic route serves the resource registry's
 * collections — list with cursor pagination and sparse fields, create with an optional
 * Idempotency-Key. Cards keep a dedicated route for its richer filters.
 */

type Params = { params: Promise<{ resource: string }> };

export async function GET(request: Request, { params }: Params): Promise<Response> {
  const { resource } = await params;
  const def = RESOURCES[resource];
  if (!def) return notFound();

  const context = await apiContext(request);
  if (!context) return unauthorized();
  if (!scopeAllows(context.scopes, def.readScope)) return forbidden();
  if (!(await withinRateLimit(context.actor))) return rateLimited();

  const url = new URL(request.url);
  const { limit, cursor } = pageQuery(url);
  if (cursor === "invalid") return badRequest("invalid cursor");

  const { items, nextCursor } = await def.list(context.userId, {
    limit,
    cursor,
    params: url.searchParams,
  });
  const fields = parseFields(url.searchParams.get("fields"));

  return jsonResponse({
    data: items.map((item) => pickFields(item as Record<string, unknown>, fields)),
    next_cursor: nextCursor ? encodeCursor(nextCursor) : null,
  });
}

export async function POST(request: Request, { params }: Params): Promise<Response> {
  const { resource } = await params;
  const def = RESOURCES[resource];
  if (!def?.create) return notFound();

  const context = await apiContext(request);
  if (!context) return unauthorized();
  if (!scopeAllows(context.scopes, def.writeScope)) return forbidden();
  if (!(await withinRateLimit(context.actor))) return rateLimited();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("body must be JSON");
  }

  const run = async (): Promise<Response> => {
    try {
      const created = await def.create?.(context.userId, body);
      return jsonResponse({ data: created }, { status: 201 });
    } catch (error) {
      if (error instanceof ZodError) return badRequest("invalid body", error.issues);
      throw error;
    }
  };

  const key = request.headers.get("idempotency-key");
  return key ? idempotent(context.userId, key, run) : run();
}
