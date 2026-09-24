import {
  attachLabels,
  createCard,
  ensureSystemTasksBoard,
  getBoard,
  type Card,
} from "@/server/boards";

import { parseCapture, type ParsedCapture } from "./parse";

/**
 * Server-side quick capture (spec §6.2 + §4.3): parse the grammar once (ADR-015), land the
 * card in the system Tasks board's Inbox column, and turn `#tags` into board labels.
 *
 * The same function backs the inbox box, the command palette and later the REST/MCP surface,
 * so the parse + label rules cannot drift between entry points.
 */

export interface CaptureResult {
  card: Card;
  parsed: ParsedCapture;
}

export async function captureTask(
  userId: string,
  text: string,
  options: { columnName?: string } = {},
): Promise<CaptureResult | null> {
  const parsed = parseCapture(text);
  if (parsed.title === "" && parsed.tags.length === 0) return null;

  const board = await ensureSystemTasksBoard(userId);
  const payload = await getBoard(userId, board.id);
  const targetName = options.columnName ?? "Inbox";
  const column =
    payload.columns.find((candidate) => candidate.name === targetName) ?? payload.columns[0];
  if (!column) return null;

  const card = await createCard(userId, {
    boardId: board.id,
    columnId: column.id,
    title: parsed.title === "" ? parsed.tags.join(" ") : parsed.title,
    dueAt: parsed.dueAt,
    priority: parsed.priority,
  });

  if (parsed.tags.length > 0) {
    await attachLabels(userId, board.id, card.id, parsed.tags);
  }

  return { card, parsed };
}

export { parseCapture };
export type { ParsedCapture };
