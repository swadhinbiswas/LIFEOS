import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
import { getServerSession } from "@/server/auth/session";
import { ensureSystemTasksBoard, getBoard } from "@/server/boards";

import { CaptureBox } from "../_components/board/capture-box";
import { InboxList } from "../_components/board/inbox-list";

import { pageMetadata } from "@/lib/page-metadata";

export async function generateMetadata() {
  return pageMetadata("Pages.Inbox", "title");
}

/**
 * `/inbox` (spec §6.2): capture with the §4.3 grammar, then triage to Today / Upcoming /
 * Someday / Done. Both surfaces operate on the system Tasks board's Inbox column (ADR-042).
 */
export default async function InboxPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Inbox");
  const board = await ensureSystemTasksBoard(session.user.id);
  const payload = await getBoard(session.user.id, board.id);

  // The count is a page-level fact — how many are waiting — so it sits in the header rather than
  // trailing the list it describes, and the panel below needs no hint of its own. The board total
  // that used to be here is already reported by /tasks and changed nothing about what to do here.
  const inbox = payload.columns.find((column) => column.name === "Inbox");
  const waiting = inbox ? payload.cards.filter((card) => card.column_id === inbox.id).length : 0;

  return (
    <>
      <PageHeader title={t("title")} count={waiting} />
      <div className="grid max-w-3xl gap-4">
        <Panel title={t("quickCapture")} hint={t("naturalLanguage")}>
          <CaptureBox boardId={board.id} />
        </Panel>
        <Panel title={t("triage")}>
          <InboxList boardId={board.id} initialData={payload} />
        </Panel>
      </div>
    </>
  );
}
