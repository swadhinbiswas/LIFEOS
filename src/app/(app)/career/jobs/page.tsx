import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
import { getServerSession } from "@/server/auth/session";
import { getBoard } from "@/server/boards";
import { ensureJobBoard, getJobMeta } from "@/server/career";

import { BoardView } from "../../_components/board/board-view";
import { NewJobForm } from "./_components/new-job-form";

export const metadata = { title: "Jobs" };

/**
 * `/career/jobs` (spec §6.3): the job pipeline *is* the board engine (ADR-044), so the page
 * creates the spec's pipeline board on first visit and hands it to the same `BoardView` the
 * task board uses — ordering, versions, filters, saved views, virtualisation and the keyboard
 * layer all come with it. Cards carry company / excitement / source chips and link to the
 * job's own page.
 */
export default async function JobsPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Career");
  const board = await ensureJobBoard(session.user.id);
  const [payload, meta] = await Promise.all([
    getBoard(session.user.id, board.id),
    getJobMeta(session.user.id),
  ]);

  const cardMeta = Object.fromEntries(
    Object.entries(meta).map(([cardId, chips]) => [
      cardId,
      chips.map((chip) => ({ label: chip.label, href: chip.detailHref })),
    ]),
  );

  return (
    <>
      <PageHeader title={t("jobsTitle")} />
      <div className="grid min-w-0 gap-4">
        <Panel title={t("addJob")}>
          <NewJobForm boardId={board.id} />
        </Panel>
        <BoardView boardId={board.id} initialData={payload} cardMeta={cardMeta} />
      </div>
    </>
  );
}
