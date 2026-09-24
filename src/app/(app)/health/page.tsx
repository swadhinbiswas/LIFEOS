import { redirect } from "next/navigation";

import { Panel } from "@/components/tui/panel";
import { getServerSession } from "@/server/auth/session";
import { healthSummary, listHealth } from "@/server/health";
import { dayKey } from "@/server/habits/streak";

import { HealthForm } from "./_components/health-form";

export const metadata = { title: "Health" };

/**
 * `/health` (spec §6.6, "health-lite"): simple logs for sleep, workouts, water, mood and weight,
 * with week-over-week averages. No medical claims, and the unit is whatever the user typed.
 */
export default async function HealthPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const today = dayKey(new Date());
  const [summary, recent] = await Promise.all([
    healthSummary(session.user.id, today),
    listHealth(session.user.id, { days: 28, today }),
  ]);

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">Health</h1>

      <div className="grid max-w-3xl gap-4">
        <p className="font-mono text-[10px] text-muted-foreground" data-slot="health-disclaimer">
          your own logs, nothing medical — entries keep the unit you type and are never converted.
        </p>

        <Panel title="Log" hint={today}>
          <HealthForm defaultDate={today} />
        </Panel>

        <Panel title="Trends · 4 weeks" hint={`${summary.trends.length} kinds`}>
          {summary.trends.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">
              nothing logged yet — the weekly averages appear here
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {summary.trends.map((trend) => (
                <li
                  key={trend.kind}
                  data-slot="trend-row"
                  className="flex flex-wrap items-center gap-2 border border-border px-2 py-1 font-mono text-xs"
                >
                  <span className="min-w-24">{trend.kind}</span>
                  <span className="tabular-nums">
                    {trend.thisWeek ?? "—"} {trend.unit ?? ""} this week
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    last {trend.lastWeek ?? "—"}
                  </span>
                  {trend.delta !== null ? (
                    <span className={trend.delta >= 0 ? "text-success" : "text-warning"}>
                      {trend.delta > 0 ? "+" : ""}
                      {trend.delta}
                    </span>
                  ) : null}
                  <span className="ml-auto text-muted-foreground">{trend.entries} entries</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent" hint={`${recent.length}`}>
          {recent.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">no entries yet</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {recent.slice(0, 12).map((row) => (
                <li
                  key={row.id}
                  data-slot="health-row"
                  className="flex flex-wrap items-center gap-2 border border-border px-2 py-1 font-mono text-xs"
                >
                  <time dateTime={row.date}>{row.date}</time>
                  <span className="text-primary">{row.kind}</span>
                  <span className="tabular-nums">
                    {row.value} {row.unit ?? ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
