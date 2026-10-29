import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
import { Progress } from "@/components/ui/progress";
import { getServerSession } from "@/server/auth/session";
import { listGoals } from "@/server/goals";
import { listHabits } from "@/server/habits";

import {
  AddGoalForm,
  AddKeyResultForm,
  GoalStatusButton,
  KeyResultControls,
} from "./_components/goals-controls";

import { pageMetadata } from "@/lib/page-metadata";

export async function generateMetadata() {
  return pageMetadata("Pages.Goals", "title");
}

/**
 * `/goals` (spec §6.4): objectives with key results. Every percentage is derived (key results
 * over their targets, linked results over the cards and habits behind them), so an objective can
 * never report progress its work does not support. The check-in banner is derived too: an active
 * goal whose key results have not moved for a week.
 */
export default async function GoalsPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Goals");
  const goals = await listGoals(session.user.id);
  const habits = await listHabits(session.user.id);
  const stale = goals.filter((goal) => goal.needsCheckIn).length;

  return (
    <>
      <PageHeader title={t("title")} count={goals.length} />

      <div className="grid max-w-4xl gap-4">
        {stale > 0 ? (
          <Panel title={t("checkIn")} hint={`${stale}`}>
            <p role="status" className="font-mono text-xs text-warning">
              {t("checkInBody", { count: stale })}
            </p>
          </Panel>
        ) : null}

        <Panel title={t("newObjective")}>
          <AddGoalForm />
        </Panel>

        {goals.length === 0 ? (
          <Panel title={t("objectives")}>
            <p className="font-mono text-xs text-muted-foreground">{t("noObjectives")}</p>
          </Panel>
        ) : (
          goals.map((goal) => (
            <Panel
              key={goal.goal.id}
              title={goal.goal.title}
              hint={`${goal.progress}% · ${goal.goal.period ?? "no cycle"}${goal.goal.status !== "active" ? ` · ${goal.goal.status}` : ""}`}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Progress
                    value={goal.progress}
                    aria-label={goal.goal.title}
                    className="h-2 w-32"
                  />
                  <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                    {goal.progress}%
                  </span>
                  {goal.links.total > 0 ? (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {t("linked", { done: goal.links.done, total: goal.links.total })}
                    </span>
                  ) : null}
                  <span className="ml-auto">
                    <GoalStatusButton goalId={goal.goal.id} status={goal.goal.status} />
                  </span>
                </div>

                {goal.keyResults.length === 0 ? (
                  <p className="font-mono text-xs text-muted-foreground">{t("noKeyResults")}</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {goal.keyResults.map((entry) => (
                      <li
                        key={entry.row.id}
                        data-slot="key-result-row"
                        data-key-result-id={entry.row.id}
                        className="flex flex-wrap items-center gap-3 border border-border px-2 py-1 font-mono text-xs"
                      >
                        <span className="min-w-0 flex-1 truncate">{entry.row.title}</span>
                        <Progress
                          value={entry.progress ?? 0}
                          aria-label={entry.row.title}
                          className="h-1.5 w-24"
                        />
                        <span className="text-muted-foreground">{entry.row.kind}</span>
                        <KeyResultControls
                          keyResultId={entry.row.id}
                          current={entry.row.current}
                          kind={entry.row.kind}
                        />
                        <span className="w-10 text-right tabular-nums">
                          {entry.progress === null ? "—" : `${entry.progress}%`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <AddKeyResultForm goalId={goal.goal.id} habits={habits} />
              </div>
            </Panel>
          ))
        )}
      </div>
    </>
  );
}
