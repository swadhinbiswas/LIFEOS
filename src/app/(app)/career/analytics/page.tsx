import { redirect } from "next/navigation";

import { Panel } from "@/components/tui/panel";
import { getServerSession } from "@/server/auth/session";
import { getFunnel } from "@/server/career";

export const metadata = { title: "Career analytics" };

/**
 * `/career/analytics` (spec §6.3 "pipeline analytics"): the funnel, time-in-stage and response
 * rate derived from the append-only stage history (ADR-044) — no summary table, so the numbers
 * can never disagree with the board.
 *
 * Source- and resume-version breakdowns, applications-per-week and ghosted detection build on
 * this same service result in the next chunk.
 */
export default async function CareerAnalyticsPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const funnel = await getFunnel(session.user.id);

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">
        Career analytics
      </h1>

      <div className="grid max-w-3xl gap-4">
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
                  <th
                    scope="col"
                    className="border-b border-border px-2 py-1 text-left font-medium tracking-wider text-muted-foreground uppercase"
                  >
                    stage
                  </th>
                  <th
                    scope="col"
                    className="border-b border-border px-2 py-1 text-right font-medium tracking-wider text-muted-foreground uppercase"
                  >
                    in stage
                  </th>
                  <th
                    scope="col"
                    className="border-b border-border px-2 py-1 text-right font-medium tracking-wider text-muted-foreground uppercase"
                  >
                    mean days
                  </th>
                </tr>
              </thead>
              <tbody>
                {funnel.stages.map((stage) => (
                  <tr key={stage.stage} data-slot="funnel-row">
                    <td className="border-b border-border px-2 py-1">{stage.stage}</td>
                    <td className="border-b border-border px-2 py-1 text-right tabular-nums">
                      {stage.count}
                    </td>
                    <td className="border-b border-border px-2 py-1 text-right tabular-nums text-muted-foreground">
                      {stage.averageDaysInStage === null ? "—" : stage.averageDaysInStage}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="font-mono text-[10px] text-muted-foreground">
            mean days pairs each stage entry with the next one in the history; the newest stage runs
            until now
          </p>
        </Panel>
      </div>
    </>
  );
}
