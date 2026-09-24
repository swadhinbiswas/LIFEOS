import { redirect } from "next/navigation";

import { Panel } from "@/components/tui/panel";
import { getServerSession } from "@/server/auth/session";
import { getCareerAnalytics } from "@/server/career/analytics";

export const metadata = { title: "Career analytics" };

const cell = "border-b border-border px-2 py-1";
const head =
  "border-b border-border px-2 py-1 text-left font-medium tracking-wider text-muted-foreground uppercase";

/**
 * `/career/analytics` (spec §6.3 "pipeline analytics"): funnel and time-in-stage, response rate
 * by source, applications per week and ghosted detection. Everything is derived at read time
 * from the append-only stage history (ADR-044), so no number can disagree with the board.
 */
export default async function CareerAnalyticsPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const analytics = await getCareerAnalytics(session.user.id);
  const { funnel, bySource, perWeek, ghosted } = analytics;
  const busiestWeek = Math.max(1, ...perWeek.map((week) => week.count));

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">
        Career analytics
      </h1>

      <div className="grid max-w-4xl gap-4">
        <Panel
          title="Funnel"
          hint={`${funnel.total} job${funnel.total === 1 ? "" : "s"} · response ${Math.round(funnel.responseRate * 100)}%`}
        >
          {funnel.total === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">
              no jobs tracked yet — add one from the pipeline
            </p>
          ) : (
            <table className="w-full border-collapse font-mono text-xs">
              <thead>
                <tr>
                  <th scope="col" className={head}>
                    stage
                  </th>
                  <th scope="col" className={`${head} text-right`}>
                    in stage
                  </th>
                  <th scope="col" className={`${head} text-right`}>
                    mean days
                  </th>
                </tr>
              </thead>
              <tbody>
                {funnel.stages.map((stage) => (
                  <tr key={stage.stage} data-slot="funnel-row">
                    <td className={cell}>{stage.stage}</td>
                    <td className={`${cell} text-right tabular-nums`}>{stage.count}</td>
                    <td className={`${cell} text-right tabular-nums text-muted-foreground`}>
                      {stage.averageDaysInStage === null ? "—" : stage.averageDaysInStage}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="By source" hint={`${bySource.length}`}>
          {bySource.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">no sources recorded yet</p>
          ) : (
            <table className="w-full border-collapse font-mono text-xs">
              <thead>
                <tr>
                  <th scope="col" className={head}>
                    source
                  </th>
                  <th scope="col" className={`${head} text-right`}>
                    jobs
                  </th>
                  <th scope="col" className={`${head} text-right`}>
                    progressed
                  </th>
                  <th scope="col" className={`${head} text-right`}>
                    rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {bySource.map((row) => (
                  <tr key={row.source} data-slot="source-row">
                    <td className={cell}>{row.source}</td>
                    <td className={`${cell} text-right tabular-nums`}>{row.total}</td>
                    <td className={`${cell} text-right tabular-nums`}>{row.progressed}</td>
                    <td className={`${cell} text-right tabular-nums text-muted-foreground`}>
                      {Math.round(row.rate * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Applications per week" hint={`last ${perWeek.length}`}>
          <ul className="flex flex-col gap-1 font-mono text-xs">
            {perWeek.map((week) => (
              <li key={week.weekStart} data-slot="week-row" className="flex items-center gap-2">
                <time dateTime={week.weekStart} className="text-muted-foreground">
                  {week.weekStart}
                </time>
                <span aria-hidden="true" className="text-primary">
                  {"▇".repeat(Math.round((week.count / busiestWeek) * 12))}
                </span>
                <span className="tabular-nums">{week.count}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Ghosted" hint={`no update in ${analytics.ghostThresholdDays}+ days`}>
          {ghosted.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">
              nothing is going stale — every job moved recently
            </p>
          ) : (
            <ul className="flex flex-col gap-1 font-mono text-xs">
              {ghosted.map((row) => (
                <li
                  key={row.cardId}
                  data-slot="ghosted-row"
                  className="flex flex-wrap items-center gap-2 border border-border px-2 py-1"
                >
                  <span className="min-w-0 flex-1 truncate">{row.title}</span>
                  <span className="text-muted-foreground">{row.stage}</span>
                  <span className="text-warning tabular-nums">{row.days}d</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
