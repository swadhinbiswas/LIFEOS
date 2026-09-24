import { redirect } from "next/navigation";

import { getServerSession } from "@/server/auth/session";
import { ensureSystemTasksBoard, getBoard } from "@/server/boards";

import { BoardView } from "../_components/board/board-view";

export const metadata = { title: "Tasks" };

/**
 * `/tasks` renders the per-user system board (ADR-042): Inbox / Today / Upcoming / Someday /
 * Done. Due-date views and quick filters layer on top of the same board in later chunks.
 */
export default async function TasksPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const board = await ensureSystemTasksBoard(session.user.id);
  const payload = await getBoard(session.user.id, board.id);

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">Tasks</h1>
      <BoardView boardId={board.id} initialData={payload} />
    </>
  );
}
