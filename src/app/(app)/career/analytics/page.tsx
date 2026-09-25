import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/tui/page-header";
import { getServerSession } from "@/server/auth/session";
import { getCareerAnalytics } from "@/server/career/analytics";
import { getRegionalSettings } from "@/server/settings";

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

  const t = await getTranslations("Pages.Career");
  const { timeZone, weekStart } = await getRegionalSettings(session.user.id);
  const analytics = await getCareerAnalytics(session.user.id, new Date(), 21, timeZone, weekStart);
  const { funnel, bySource, perWeek, ghosted } = analytics;
  const busiestWeek = Math.max(1, ...perWeek.map((week) => week.count));

  return (
    <>
      <PageHeader title={t("analyticsTitle")} />

      <div className="grid max-w-4xl gap-4">
        <Panel
          title={t("funnel")}
          hint={t("funnelHint", {
            total: funnel.total,
            rate: Math.round(funnel.responseRate * 100),
          })}
        >
          {funnel.total === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">{t("noJobs")}</p>
          ) : (
            <Table className="font-mono text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className={head}>
                    {t("stage")}
                  </TableHead>
                  <TableHead scope="col" className={`${head} text-right`}>
                    {t("inStage")}
                  </TableHead>
                  <TableHead scope="col" className={`${head} text-right`}>
                    {t("meanDays")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {funnel.stages.map((stage) => (
                  <TableRow key={stage.stage} data-slot="funnel-row">
                    <TableCell className={cell}>{stage.stage}</TableCell>
                    <TableCell className={`${cell} text-right tabular-nums`}>
                      {stage.count}
                    </TableCell>
                    <TableCell className={`${cell} text-right tabular-nums text-muted-foreground`}>
                      {stage.averageDaysInStage === null ? "—" : stage.averageDaysInStage}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>

        <Panel title={t("bySource")} hint={`${bySource.length}`}>
          {bySource.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">{t("noSources")}</p>
          ) : (
            <Table className="font-mono text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className={head}>
                    {t("source")}
                  </TableHead>
                  <TableHead scope="col" className={`${head} text-right`}>
                    {t("jobs")}
                  </TableHead>
                  <TableHead scope="col" className={`${head} text-right`}>
                    {t("progressed")}
                  </TableHead>
                  <TableHead scope="col" className={`${head} text-right`}>
                    {t("rate")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bySource.map((row) => (
                  <TableRow key={row.source} data-slot="source-row">
                    <TableCell className={cell}>{row.source}</TableCell>
                    <TableCell className={`${cell} text-right tabular-nums`}>{row.total}</TableCell>
                    <TableCell className={`${cell} text-right tabular-nums`}>
                      {row.progressed}
                    </TableCell>
                    <TableCell className={`${cell} text-right tabular-nums text-muted-foreground`}>
                      {Math.round(row.rate * 100)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>

        <Panel title={t("perWeek")} hint={t("lastN", { n: perWeek.length })}>
          <ul className="flex flex-col gap-1 font-mono text-xs">
            {perWeek.map((week) => (
              <li key={week.weekStart} data-slot="week-row" className="flex items-center gap-2">
                <time dateTime={week.weekStart} className="text-muted-foreground tabular-nums">
                  {week.weekStart}
                </time>
                <Progress
                  value={(week.count / busiestWeek) * 100}
                  aria-label={week.weekStart}
                  className="h-1.5 flex-1"
                />
                <span className="w-8 text-right tabular-nums">{week.count}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={t("ghosted")} hint={t("ghostedHint", { days: analytics.ghostThresholdDays })}>
          {ghosted.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">{t("nothingStale")}</p>
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
