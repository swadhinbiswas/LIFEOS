import { redirect } from "next/navigation";

import { Panel } from "@/components/tui/panel";
import { getServerSession } from "@/server/auth/session";
import { ensureSystemTasksBoard, getBoard } from "@/server/boards";

import { CaptureBox } from "../_components/board/capture-box";
import { InboxList } from "../_components/board/inbox-list";

export const metadata = { title: "Inbox" };

/**
 * `/inbox` (spec §6.2): capture with the §4.3 grammar, then triage to Today / Upcoming /
 * Someday / Done. Both surfaces operate on the system Tasks board's Inbox column (ADR-042).
 */
export default async function InboxPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const board = await ensureSystemTasksBoard(session.user.id);
  const payload = await getBoard(session.user.id, board.id);

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">Inbox</h1>
      <div className="grid max-w-3xl gap-4">
        <Panel title="Quick capture" hint="natural language">
          <CaptureBox boardId={board.id} />
        </Panel>
        <Panel title="Triage" hint={`${payload.cards.length} on the board`}>
          <InboxList boardId={board.id} initialData={payload} />
        </Panel>
      </div>
    </>
  );
}
