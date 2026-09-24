import { serializeCard } from "@/server/api/v1/cards";
import { apiContext, scopeAllows } from "@/server/api/v1/context";
import {
  badRequest,
  forbidden,
  jsonResponse,
  rateLimited,
  unauthorized,
} from "@/server/api/v1/http";
import { ingestBody } from "@/server/api/v1/schemas";
import { idempotent, withinRateLimit } from "@/server/api/v1/support";
import { captureTask } from "@/server/capture";

/**
 * `/api/v1/ingest` (spec §9.1, ADR-065): the quick-capture grammar over HTTP, for iOS Shortcuts,
 * browser bookmarklets and automations. It calls the *same* `captureTask` the inbox box uses, so a
 * `#tag`/date/`!priority` string lands identically whichever way it arrives.
 */

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
  const parsed = ingestBody.safeParse(body);
  if (!parsed.success) return badRequest("invalid body", parsed.error.issues);

  const run = async (): Promise<Response> => {
    const result = await captureTask(context.userId, parsed.data.text, {
      columnName: parsed.data.columnName,
    });
    if (!result) return badRequest("nothing to capture — the text had no title or tags");
    return jsonResponse(
      { data: { card: serializeCard(result.card), parsed: result.parsed } },
      { status: 201 },
    );
  };

  const key = request.headers.get("idempotency-key");
  return key ? idempotent(context.userId, key, run) : run();
}
