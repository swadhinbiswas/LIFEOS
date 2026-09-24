import { cardEtag, deleteCardViaApi, getCard, updateCardViaApi } from "@/server/api/v1/cards";
import { apiContext, scopeAllows } from "@/server/api/v1/context";
import {
  badRequest,
  errorResponse,
  forbidden,
  jsonResponse,
  notFound,
  rateLimited,
  unauthorized,
} from "@/server/api/v1/http";
import { updateCardBody } from "@/server/api/v1/schemas";
import { withinRateLimit } from "@/server/api/v1/support";

/**
 * `/api/v1/cards/[id]` (spec §9.1, ADR-063): read, conditional update (`If-Match` against the
 * card's version ETag) and soft delete. The same board service the UI writes through.
 */

const updateBody = updateCardBody;

type Params = { params: Promise<{ id: string }> };

async function authorize(
  request: Request,
  required: string,
): Promise<{ userId: string; actor: string } | Response> {
  const context = await apiContext(request);
  if (!context) return unauthorized();
  if (!scopeAllows(context.scopes, required)) return forbidden();
  if (!(await withinRateLimit(context.actor))) return rateLimited();
  return { userId: context.userId, actor: context.actor };
}

export async function GET(request: Request, { params }: Params): Promise<Response> {
  const auth = await authorize(request, "read:cards");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const card = await getCard(auth.userId, id);
  if (!card) return notFound();
  return jsonResponse({ data: card }, { headers: { ETag: cardEtag(card) } });
}

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
  const auth = await authorize(request, "write:tasks");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const current = await getCard(auth.userId, id);
  if (!current) return notFound();

  const ifMatch = request.headers.get("if-match");
  if (ifMatch && ifMatch !== "*" && ifMatch !== cardEtag(current)) {
    return errorResponse(412, "precondition_failed", "the card changed since it was read");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("body must be JSON");
  }
  const parsed = updateBody.safeParse(body);
  if (!parsed.success) return badRequest("invalid body", parsed.error.issues);
  if (Object.keys(parsed.data).length === 0) return badRequest("nothing to update");

  const { dueAt, startAt, ...rest } = parsed.data;
  const updated = await updateCardViaApi(auth.userId, id, {
    ...rest,
    ...(dueAt !== undefined ? { dueAt: dueAt ? new Date(dueAt) : null } : {}),
    ...(startAt !== undefined ? { startAt: startAt ? new Date(startAt) : null } : {}),
  });
  if (!updated) return notFound();
  return jsonResponse({ data: updated }, { headers: { ETag: cardEtag(updated) } });
}

export async function DELETE(request: Request, { params }: Params): Promise<Response> {
  const auth = await authorize(request, "write:tasks");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const deleted = await deleteCardViaApi(auth.userId, id);
  if (!deleted) return notFound();
  return new Response(null, { status: 204 });
}
