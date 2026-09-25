import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
import { getServerSession } from "@/server/auth/session";
import { healthSummary, listHealth } from "@/server/health";
import { getUserDayKey } from "@/server/settings";

import { HealthForm } from "./_components/health-form";

import { pageMetadata } from "@/lib/page-metadata";

export async function generateMetadata() {
  return pageMetadata("Pages.Health", "title");
}

/**
 * `/health` (spec §6.6, "health-lite"): simple logs for sleep, workouts, water, mood and weight,
 * with week-over-week averages. No medical claims, and the unit is whatever the user typed.
 */
export default async function HealthPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Health");
  const today = await getUserDayKey(session.user.id);
  const [summary, recent] = await Promise.all([
    healthSummary(session.user.id, today),
    listHealth(session.user.id, { days: 28, today }),
  ]);

  return (
    <>
      <PageHeader title={t("title")} />

      <div className="grid max-w-3xl gap-4">
        <p className="font-mono text-[10px] text-muted-foreground" data-slot="health-disclaimer">
          {t("disclaimer")}
        </p>

        <Panel title={t("log")} hint={today}>
          <HealthForm defaultDate={today} />
        </Panel>

        <Panel title={t("trends")} hint={t("kinds", { count: summary.trends.length })}>
          {summary.trends.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">{t("nothingLogged")}</p>
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
                    {trend.thisWeek ?? "—"} {trend.unit ?? ""} {t("thisWeek")}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {t("last")} {trend.lastWeek ?? "—"}
                  </span>
                  {trend.delta !== null ? (
                    <span className={trend.delta >= 0 ? "text-success" : "text-warning"}>
                      {trend.delta > 0 ? "+" : ""}
                      {trend.delta}
                    </span>
                  ) : null}
                  <span className="ml-auto text-muted-foreground">
                    {t("entries", { count: trend.entries })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t("recent")} hint={`${recent.length}`}>
          {recent.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">{t("noEntries")}</p>
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
