import { createTask, listCards } from "@/server/api/v1/cards";
import { apiContext, scopeAllows } from "@/server/api/v1/context";
import {
  badRequest,
  forbidden,
  jsonResponse,
  rateLimited,
  unauthorized,
} from "@/server/api/v1/http";
import { createCardBody } from "@/server/api/v1/schemas";
import {
  encodeCursor,
  idempotent,
  pageQuery,
  parseFields,
  pickFields,
  withinRateLimit,
} from "@/server/api/v1/support";

/**
 * `/api/v1/cards` (spec §9.1, ADR-063): list with cursor pagination and sparse fields, create with
 * an optional Idempotency-Key. Auth is a Bearer key or the session cookie; a key needs `read:cards`
 * or `write:tasks` respectively.
 */

const createBody = createCardBody;

export async function GET(request: Request): Promise<Response> {
  const context = await apiContext(request);
  if (!context) return unauthorized();
  if (!scopeAllows(context.scopes, "read:cards")) return forbidden();
  if (!(await withinRateLimit(context.actor))) return rateLimited();

  const url = new URL(request.url);
  const { limit, cursor } = pageQuery(url);
  if (cursor === "invalid") return badRequest("invalid cursor");

  const { items, nextCursor } = await listCards(context.userId, {
    limit,
    cursor,
    boardId: url.searchParams.get("board_id"),
    q: url.searchParams.get("q"),
  });
  const fields = parseFields(url.searchParams.get("fields"));

  return jsonResponse({
    data: items.map((card) => pickFields(card as unknown as Record<string, unknown>, fields)),
    next_cursor: nextCursor ? encodeCursor(nextCursor) : null,
  });
}

export async function POST(request: Request): Promise<Response> {
  const context = await apiContext(request);
  if (!context) return unauthorized();
  if (!scopeAllows(context.scopes, "write:tasks")) return forbidden();
  if (!(await withinRateLimit(context.actor))) return rateLimited();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("body must be JSON");
  }
  const parsed = createBody.safeParse(body);
  if (!parsed.success) return badRequest("invalid body", parsed.error.issues);

  const run = async (): Promise<Response> => {
    const { title, boardId, columnId, dueAt, priority } = parsed.data;
    const card = await createTask(context.userId, {
      title,
      boardId,
      columnId,
      dueAt: dueAt ? new Date(dueAt) : null,
      priority,
    });
    return jsonResponse({ data: card }, { status: 201 });
  };

  const key = request.headers.get("idempotency-key");
  return key ? idempotent(context.userId, key, run) : run();
}
