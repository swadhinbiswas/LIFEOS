import { apiContext, scopeAllows } from "@/server/api/v1/context";
import { forbidden, jsonResponse, notFound, rateLimited, unauthorized } from "@/server/api/v1/http";
import { withinRateLimit } from "@/server/api/v1/support";
import { stopSession } from "@/server/focus";

/** `POST /api/v1/focus/sessions/[id]/stop` (spec §9.1, ADR-070): stop a running session. */

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params): Promise<Response> {
  const context = await apiContext(request);
  if (!context) return unauthorized();
  if (!scopeAllows(context.scopes, "write:life")) return forbidden();
  if (!(await withinRateLimit(context.actor))) return rateLimited();

  const { id } = await params;
  try {
    const row = await stopSession(context.userId, id);
    return jsonResponse({
      data: {
        id: row.id,
        ended_at: row.ended_at ? new Date(row.ended_at).toISOString() : null,
        completed: row.completed,
      },
    });
  } catch {
    return notFound();
  }
}
