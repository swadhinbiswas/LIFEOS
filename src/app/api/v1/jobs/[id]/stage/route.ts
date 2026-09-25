import { getCard } from "@/server/api/v1/cards";
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
import { getBoard } from "@/server/boards";
import { ensureJobBoard, moveJobStage } from "@/server/career";

/**
 * `POST /api/v1/jobs/[id]/stage` (spec §9.1): move an application to a named stage. It resolves the
 * stage by name on the job board and goes through `moveJobStage`, so the stage history, the analytics
 * and the webhook fire exactly as they do in the UI. `{ "stage": "Interview" }`.
 */

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params): Promise<Response> {
  const context = await apiContext(request);
  if (!context) return unauthorized();
  if (!scopeAllows(context.scopes, "write:jobs")) return forbidden();
  if (!(await withinRateLimit(context.actor))) return rateLimited();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("body must be JSON");
  }
  const stageName = (body as { stage?: unknown }).stage;
  if (typeof stageName !== "string" || stageName.trim() === "") {
    return badRequest("body must be { stage: string }");
  }

  const { id } = await params;
  const job = await RESOURCES.jobs?.get?.(context.userId, id);
  const cardId = job ? (job as { card_id?: string }).card_id : undefined;
  if (!cardId) return notFound();

  const card = await getCard(context.userId, cardId);
  if (!card) return notFound();

  const board = await ensureJobBoard(context.userId);
  const payload = await getBoard(context.userId, board.id);
  const target = stageName.trim().toLowerCase();
  const column = payload.columns.find((candidate) => candidate.name.toLowerCase() === target);
  if (!column) {
    return badRequest(
      `unknown stage: ${stageName} (one of ${payload.columns.map((c) => c.name).join(", ")})`,
    );
  }

  const moved = await moveJobStage(context.userId, {
    applicationId: id,
    version: card.version,
    toColumnId: column.id,
    prevCardId: null,
    nextCardId: null,
  });

  return jsonResponse({ data: { id, stage: column.name, card_id: moved.id } });
}
