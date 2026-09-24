import Link from "next/link";
import { redirect } from "next/navigation";

import { Panel } from "@/components/tui/panel";
import { getServerSession } from "@/server/auth/session";
import { ensureSystemTasksBoard } from "@/server/boards";
import { getDailyBrief } from "@/server/boards/brief";
import { getDashboardKpis, KPI_DEFINITIONS } from "@/server/dashboard";

export const metadata = { title: "Dashboard" };

const money = (minor: number, unit: string | null): string => {
  const whole = (minor / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return unit ? `${whole} ${unit}` : whole;
};

const renderValue = (value: number | null, unit: string | null): string => {
  if (value === null) return "—";
  if (unit && /^[A-Z]{3}$/u.test(unit)) return money(value, unit);
  return unit ? `${value} ${unit}` : String(value);
};

/**
 * `/dashboard` (spec §6.8): the Overview variant. Every KPI is a pure, fixture-tested computation
 * with a plain-language definition (tooltip) and a link to the filtered list behind it, and the KPI
 * table *is* the accessible alternative to a chart — no image stands in for a number. The Today
 * panel reuses the daily brief, so this page and `/tasks` cannot disagree.
 */
export default async function DashboardPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  // The brief needs the system board to exist; the dashboard itself reads across modules.
  await ensureSystemTasksBoard(session.user.id);
  const [brief, kpis] = await Promise.all([
    getDailyBrief(session.user.id),
    getDashboardKpis(session.user.id),
  ]);

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">Dashboard</h1>

      <div className="grid max-w-4xl gap-4">
        <Panel title="Today" hint={`${brief.openCards} open`}>
          <div className="flex flex-col gap-2 text-xs">
            <dl className="flex flex-wrap gap-4 font-mono text-[10px] uppercase">
              <div className="flex items-center gap-1">
                <dt className="text-muted-foreground">overdue</dt>
                <dd className={brief.overdue.length > 0 ? "text-warning" : "text-muted-foreground"}>
                  {brief.overdue.length}
                </dd>
              </div>
              <div className="flex items-center gap-1">
                <dt className="text-muted-foreground">due today</dt>
                <dd className="text-muted-foreground">{brief.dueToday.length}</dd>
              </div>
              <div className="flex items-center gap-1">
                <dt className="text-muted-foreground">inbox</dt>
                <dd className="text-muted-foreground">{brief.inbox.length}</dd>
              </div>
              <div className="flex items-center gap-1">
                <dt className="text-muted-foreground">planned</dt>
                <dd className="text-muted-foreground tabular-nums">
                  {brief.estimatedMinutesToday} min
                </dd>
              </div>
            </dl>

            {brief.top.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground">nothing open — nice</p>
            ) : (
              <ol className="flex flex-col gap-1">
                {brief.top.map((card) => (
                  <li key={card.id}>
                    <Link
                      href={`/tasks?card=${card.id}`}
                      className="font-mono text-xs hover:text-primary"
                    >
                      {card.priority ? `[${card.priority}] ` : ""}
                      {card.title}
                    </Link>
                  </li>
                ))}
              </ol>
            )}
            <Link
              href="/tasks"
              className="font-mono text-[10px] text-muted-foreground hover:underline"
            >
              open the board →
            </Link>
          </div>
        </Panel>

        <Panel title="Overview" hint={`vs week of ${kpis.weekStart}`}>
          <table className="w-full border-collapse font-mono text-xs">
            <caption className="sr-only">
              Key numbers with their change against the previous week, each linking to the list it
              comes from
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="border-b border-border px-2 py-1 text-left uppercase text-muted-foreground"
                >
                  metric
                </th>
                <th
                  scope="col"
                  className="border-b border-border px-2 py-1 text-right uppercase text-muted-foreground"
                >
                  value
                </th>
                <th
                  scope="col"
                  className="border-b border-border px-2 py-1 text-right uppercase text-muted-foreground"
                >
                  change
                </th>
                <th
                  scope="col"
                  className="border-b border-border px-2 py-1 text-left uppercase text-muted-foreground"
                >
                  source
                </th>
              </tr>
            </thead>
            <tbody>
              {kpis.values.map((kpi) => {
                const definition = KPI_DEFINITIONS[kpi.id];
                return (
                  <tr key={kpi.id} data-slot="kpi-row" data-kpi={kpi.id}>
                    <th
                      scope="row"
                      className="border-b border-border px-2 py-1 text-left font-normal"
                    >
                      <span title={definition?.definition}>{definition?.label ?? kpi.id}</span>
                    </th>
                    <td className="border-b border-border px-2 py-1 text-right tabular-nums">
                      {renderValue(kpi.value, kpi.unit)}
                    </td>
                    <td
                      className={`border-b border-border px-2 py-1 text-right tabular-nums ${
                        kpi.delta === null
                          ? "text-muted-foreground"
                          : kpi.delta >= 0
                            ? "text-success"
                            : "text-warning"
                      }`}
                    >
                      {kpi.delta === null ? "—" : `${kpi.delta > 0 ? "+" : ""}${kpi.delta}`}
                    </td>
                    <td className="border-b border-border px-2 py-1">
                      {definition ? (
                        <Link href={definition.href} className="text-primary hover:underline">
                          open list
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="font-mono text-[10px] text-muted-foreground">
            a dash means no earlier period exists to compare against — the number stays a fact, not
            a trend
          </p>
        </Panel>
      </div>
    </>
  );
}
