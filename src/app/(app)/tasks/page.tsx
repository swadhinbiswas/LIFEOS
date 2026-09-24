import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getServerSession } from "@/server/auth/session";
import { ensureSystemTasksBoard, getBoard } from "@/server/boards";
import { getDailyBrief } from "@/server/boards/brief";
import { getTimeZone } from "@/server/settings";

import { CopilotQuickAction } from "../_components/copilot-quick-action";
import { BoardView } from "../_components/board/board-view";
import { PlanMyDay } from "../_components/board/plan-my-day";

export const metadata = { title: "Tasks" };

/**
 * `/tasks` renders the per-user system board (ADR-042): Inbox / Today / Upcoming / Someday /
 * Done. Due-date views and quick filters layer on top of the same board in later chunks.
 */
export default async function TasksPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Tasks");
  const tCopilot = await getTranslations("Pages.Copilot");
  const board = await ensureSystemTasksBoard(session.user.id);
  const payload = await getBoard(session.user.id, board.id);
  const brief = await getDailyBrief(
    session.user.id,
    new Date(),
    await getTimeZone(session.user.id),
  );

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">
        {t("title")}
      </h1>
      <div className="grid gap-4">
        <div className="flex justify-end">
          <CopilotQuickAction
            label={tCopilot("planMyDay")}
            prompt="Plan my day: call get_daily_brief, then propose the three most valuable tasks for today and note anything overdue."
          />
        </div>
        <PlanMyDay boardId={board.id} brief={brief} />
        <BoardView boardId={board.id} initialData={payload} />
      </div>
    </>
  );
}
