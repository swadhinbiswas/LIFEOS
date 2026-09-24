import { z } from "zod";

import { apiContext, scopeAllows } from "@/server/api/v1/context";
import {
  badRequest,
  forbidden,
  jsonResponse,
  notFound,
  rateLimited,
  unauthorized,
} from "@/server/api/v1/http";
import { withinRateLimit } from "@/server/api/v1/support";
import { setHabitLog } from "@/server/habits";

/** `POST /api/v1/habits/[id]/logs` (spec §9.1, ADR-070): log a habit for a day. */

const logBody = z.object({
  date: z.iso.date().optional(),
  value: z.number().int().min(0).max(100_000),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params): Promise<Response> {
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
  const parsed = logBody.safeParse(body);
  if (!parsed.success) return badRequest("invalid body", parsed.error.issues);

  const { id } = await params;
  try {
    await setHabitLog(context.userId, {
      habitId: id,
      date: parsed.data.date,
      value: parsed.data.value,
    });
  } catch {
    return notFound();
  }
  return jsonResponse(
    { data: { habitId: id, value: parsed.data.value, date: parsed.data.date ?? null } },
    { status: 201 },
  );
}
