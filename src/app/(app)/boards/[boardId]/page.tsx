import { notFound, redirect } from "next/navigation";

import { getServerSession } from "@/server/auth/session";
import { BoardError, getBoard } from "@/server/boards";

import { BoardView } from "../../_components/board/board-view";

type PageProps = { params: Promise<{ boardId: string }> };

/** `/boards/[boardId]` — the shared board surface (spec §6.1, ADR-042). */
export default async function BoardPage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const { boardId } = await params;

  // The service call is caught here; JSX stays outside try/catch, which React would not catch.
  const payload = await getBoard(session.user.id, boardId).catch((error: unknown) => {
    if (error instanceof BoardError && error.code === "not_found") return null;
    throw error;
  });
  if (!payload) notFound();

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">
        {payload.board.name}
      </h1>
      <BoardView boardId={boardId} initialData={payload} />
    </>
  );
}
