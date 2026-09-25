import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
import { getServerSession } from "@/server/auth/session";
import { focusTotals, getRunningSession, listSessions } from "@/server/focus";
import { getRegionalSettings } from "@/server/settings";

import { FocusTimer } from "./_components/focus-timer";

export const metadata = { title: "Focus" };

/**
 * `/focus` (spec §6.7): the timer, today's and this week's totals, and the recent session log.
 * A running session is a database row, so this page (or any other) shows the truth after a
 * reload — nothing lives only in a component.
 */
export default async function FocusPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Focus");
  const { timeZone, weekStart } = await getRegionalSettings(session.user.id);
  const [running, totals, sessions] = await Promise.all([
    getRunningSession(session.user.id),
    focusTotals(session.user.id, new Date(), timeZone, weekStart),
    listSessions(session.user.id),
  ]);

  return (
    <>
      <PageHeader title={t("title")} count={sessions.length} />

      <div className="grid max-w-3xl gap-4">
        <Panel
          title={t("timer")}
          hint={t("timerHint", { today: totals.todayMin, week: totals.weekMin })}
        >
          <FocusTimer
            sessionId={running?.id ?? null}
            startedAt={running ? new Date(running.started_at).toISOString() : null}
            plannedMin={running?.planned_min ?? null}
          />
        </Panel>

        <Panel title={t("recent")} hint={`${sessions.length}`}>
          {sessions.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {sessions.map((row) => {
                const minutes = row.ended_at
                  ? Math.max(
                      0,
                      Math.round(
                        (new Date(row.ended_at).getTime() - new Date(row.started_at).getTime()) /
                          60000,
                      ),
                    )
                  : null;
                return (
                  <li
                    key={row.id}
                    data-slot="focus-row"
                    className="flex flex-wrap items-center gap-2 border border-border px-2 py-1 font-mono text-xs"
                  >
                    <time dateTime={new Date(row.started_at).toISOString()}>
                      {new Date(row.started_at).toISOString().slice(0, 16).replace("T", " ")}
                    </time>
                    <span className="text-muted-foreground tabular-nums">
                      {minutes === null ? t("running") : t("min", { count: minutes })}
                    </span>
                    {row.planned_min ? (
                      <span className="text-muted-foreground">
                        {t("planned", { count: row.planned_min })}
                      </span>
                    ) : null}
                    {row.ended_at ? (
                      <span className={row.completed ? "text-success" : "text-warning"}>
                        {row.completed ? t("completed") : t("cutShort")}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
