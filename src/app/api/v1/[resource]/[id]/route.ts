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
import { withinRateLimit } from "@/server/api/v1/support";

/** `/api/v1/[resource]/[id]` (spec §9.1, ADR-070): read, update and delete one registry item. */

type Params = { params: Promise<{ resource: string; id: string }> };

export async function GET(request: Request, { params }: Params): Promise<Response> {
  const { resource, id } = await params;
  const def = RESOURCES[resource];
  if (!def?.get) return notFound();

  const context = await apiContext(request);
  if (!context) return unauthorized();
  if (!scopeAllows(context.scopes, def.readScope)) return forbidden();
  if (!(await withinRateLimit(context.actor))) return rateLimited();

  const item = await def.get(context.userId, id);
  if (!item) return notFound();
  return jsonResponse({ data: item });
}

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
  const { resource, id } = await params;
  const def = RESOURCES[resource];
  if (!def?.update) return notFound();

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

  try {
    const updated = await def.update(context.userId, id, body);
    if (!updated) return notFound();
    return jsonResponse({ data: updated });
  } catch (error) {
    if (error instanceof ZodError) return badRequest("invalid body", error.issues);
    throw error;
  }
}

export async function DELETE(request: Request, { params }: Params): Promise<Response> {
  const { resource, id } = await params;
  const def = RESOURCES[resource];
  if (!def?.remove) return notFound();

  const context = await apiContext(request);
  if (!context) return unauthorized();
  if (!scopeAllows(context.scopes, def.writeScope)) return forbidden();
  if (!(await withinRateLimit(context.actor))) return rateLimited();

  const removed = await def.remove(context.userId, id);
  if (!removed) return notFound();
  return new Response(null, { status: 204 });
}
