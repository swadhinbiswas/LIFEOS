import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getServerSession } from "@/server/auth/session";
import { BoardError, getBoard } from "@/server/boards";

import { CopilotQuickAction } from "../../_components/copilot-quick-action";
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

  const t = await getTranslations("Pages.Copilot");
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">
          {payload.board.name}
        </h1>
        <CopilotQuickAction
          label={t("summarizeBoard")}
          prompt={`Summarize this board: call get_board with boardId "${boardId}", then give a short status of what is in flight and what looks stuck.`}
        />
      </div>
      <BoardView boardId={boardId} initialData={payload} />
    </>
  );
}
