import { redirect } from "next/navigation";

import { getServerSession } from "@/server/auth/session";
import { getBoard } from "@/server/boards";
import { ensureJobBoard } from "@/server/career";

import { BoardView } from "../../_components/board/board-view";

export const metadata = { title: "Jobs" };

/**
 * `/career/jobs` (spec §6.3): the job pipeline *is* the board engine (ADR-044), so the page
 * creates the spec's pipeline board on first visit and hands it to the same `BoardView` the
 * task board uses — ordering, versions, filters, saved views, virtualisation and the keyboard
 * layer all come with it.
 *
 * The job-specific surfaces (company on the card face, interview log, offer comparison,
 * funnel) land in the following chunks.
 */
export default async function JobsPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const board = await ensureJobBoard(session.user.id);
  const payload = await getBoard(session.user.id, board.id);

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">Jobs</h1>
      <BoardView boardId={board.id} initialData={payload} />
    </>
  );
}
