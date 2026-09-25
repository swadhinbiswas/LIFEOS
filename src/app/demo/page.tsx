import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { getBoard, listBoards } from "@/server/boards";
import { getDailyBrief } from "@/server/boards/brief";
import { ensureJobBoard } from "@/server/career";
import { listGrowth } from "@/server/career/growth";
import { listGoals } from "@/server/goals";
import { listHabits } from "@/server/habits";
import { demoUserId } from "@/server/seed";
import { getTimeZone } from "@/server/settings";

export const metadata = { title: "Demo" };

/**
 * Public read-only demo (spec §14 Phase 8, ADR-086): the seeded demo account's data, rendered
 * through the same services the app uses, with no session and no writes. A visitor can look around
 * before creating an account; nothing here can be edited.
 */
export default async function DemoPage() {
  const t = await getTranslations("Pages.Demo");
  const userId = await demoUserId();

  if (!userId) {
    return (
      <main className="mx-auto w-full max-w-3xl p-6">
        <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">
          {t("title")}
        </h1>
        <Panel title={t("title")}>
          <p className="font-mono text-xs text-muted-foreground">{t("notSeeded")}</p>
        </Panel>
      </main>
    );
  }

  const timeZone = await getTimeZone(userId);
  const [boards, brief, jobs, habits, goals, growth] = await Promise.all([
    listBoards(userId),
    getDailyBrief(userId, new Date(), timeZone),
    ensureJobBoard(userId).then((board) => getBoard(userId, board.id)),
    listHabits(userId),
    listGoals(userId),
    listGrowth(userId),
  ]);

  const taskBoard = boards.find((board) => board.is_system) ?? boards[0];
  const taskPayload = taskBoard ? await getBoard(userId, taskBoard.id) : null;
  const jobColumns = new Map(jobs.columns.map((column) => [column.id, column.name]));

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">
        {t("title")}
      </h1>

      <div className="grid gap-4">
        <Panel title="sample" hint="read-only">
          <p className="font-mono text-[10px] text-muted-foreground">{t("banner")}</p>
          <Link
            href="/sign-up"
            className="mt-2 inline-block rounded-[var(--radius)] border border-primary bg-primary px-3 py-1.5 font-mono text-xs text-primary-foreground hover:opacity-90"
          >
            {t("createAccount")}
          </Link>
        </Panel>

        <Panel
          title={t("briefTitle")}
          hint={`${t("overdue")} ${brief.overdue.length} · ${t("open")} ${brief.openCards}`}
        >
          <ul className="flex flex-col gap-1 font-mono text-xs">
            {brief.top.map((card) => (
              <li key={card.id}>▸ {card.title}</li>
            ))}
            {brief.top.length === 0 ? <li className="text-muted-foreground">—</li> : null}
          </ul>
        </Panel>

        {taskPayload ? (
          <Panel title={t("boardTitle")} hint={`${taskPayload.cards.length}`}>
            <div
              className="flex gap-3 overflow-x-auto pb-1"
              tabIndex={0}
              aria-label={t("boardTitle")}
            >
              {taskPayload.columns.map((column) => (
                <div key={column.id} className="w-56 shrink-0 border border-border p-2">
                  <p className="font-mono text-[10px] tracking-wider uppercase">{column.name}</p>
                  <ul className="mt-1 flex flex-col gap-1 font-mono text-[11px]">
                    {taskPayload.cards
                      .filter((card) => card.column_id === column.id)
                      .slice(0, 5)
                      .map((card) => (
                        <li key={card.id}>· {card.title}</li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

        <Panel title={t("jobsTitle")} hint={`${jobs.cards.length}`}>
          <ul className="flex flex-col gap-1 font-mono text-xs">
            {jobs.cards.slice(0, 8).map((card) => (
              <li key={card.id} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{card.title}</span>
                <span className="text-muted-foreground">
                  {jobColumns.get(card.column_id) ?? ""}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={t("habitsTitle")} hint={`${habits.length}`}>
          <ul className="flex flex-col gap-1 font-mono text-xs">
            {habits.map((row) => (
              <li key={row.habit.id} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{row.habit.name}</span>
                <span className="text-muted-foreground tabular-nums">{row.streak}d</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={t("projectsTitle")} hint={`${growth.projects.length}`}>
          <ul className="flex flex-col gap-1 font-mono text-xs">
            {growth.projects.slice(0, 8).map((project) => (
              <li key={project.id} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{project.name}</span>
                {project.is_demo ? (
                  <span className="border border-border px-1 text-muted-foreground">sample</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={t("goalsTitle")} hint={`${goals.length}`}>
          <ul className="flex flex-col gap-1 font-mono text-xs">
            {goals.map((goal) => (
              <li key={goal.goal.id} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{goal.goal.title}</span>
                <span className="text-muted-foreground tabular-nums">{goal.progress}%</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </main>
  );
}
