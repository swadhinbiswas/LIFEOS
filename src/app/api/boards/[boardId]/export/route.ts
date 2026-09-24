import { NextResponse } from "next/server";

import { toCsv } from "@/lib/csv";
import { getServerSession } from "@/server/auth/session";
import { BoardError, getBoard } from "@/server/boards";

/**
 * Board export (spec §6.1 "CSV in/out, JSON in/out"). A plain download endpoint, session-gated
 * and scoped to the owner by the same service every other surface uses — the versioned public
 * API (spec §9) is Phase 5 and will wrap this same service, not this route.
 */

export async function GET(request: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const session = await getServerSession();
  if (!session) return new NextResponse("unauthorized", { status: 401 });

  const { boardId } = await params;
  const format = new URL(request.url).searchParams.get("format") === "json" ? "json" : "csv";

  let payload;
  try {
    payload = await getBoard(session.user.id, boardId);
  } catch (error) {
    if (error instanceof BoardError && error.code === "not_found") {
      return new NextResponse("not found", { status: 404 });
    }
    throw error;
  }

  const columnName = (columnId: string) =>
    payload.columns.find((column) => column.id === columnId)?.name ?? "";
  const rows = payload.cards.map((card) => ({
    id: card.id,
    title: card.title,
    column: columnName(card.column_id),
    priority: card.priority,
    due_at: card.due_at,
    start_at: card.start_at,
    estimate_min: card.estimate_min,
    completed_at: card.completed_at,
    recurrence: card.recurrence,
    description: card.description,
  }));

  const slug = payload.board.slug;
  if (format === "json") {
    return new NextResponse(
      JSON.stringify(
        { board: payload.board.name, exported_at: new Date().toISOString(), cards: rows },
        null,
        2,
      ),
      {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="${slug}.json"`,
        },
      },
    );
  }

  const csv = toCsv(rows, [
    "id",
    "title",
    "column",
    "priority",
    "due_at",
    "start_at",
    "estimate_min",
    "completed_at",
    "recurrence",
    "description",
  ]);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${slug}.csv"`,
    },
  });
}
