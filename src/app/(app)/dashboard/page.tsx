import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { cn } from "cn";
import { Panel } from "@/components/tui/panel";
import { AsciiMeter } from "@/components/tui/ascii-meter";
import { PageHeader } from "@/components/tui/page-header";
import { StatCard } from "@/components/tui/stat-card";
import { getServerSession } from "@/server/auth/session";
import { ensureSystemTasksBoard } from "@/server/boards";
import { getDailyBrief } from "@/server/boards/brief";
import { getCareerAnalytics } from "@/server/career/analytics";
import {
  DASHBOARD_VARIANTS,
  DASHBOARD_WIDGETS,
  type DashboardVariant,
} from "@/config/dashboard-widgets";
import { dayKeyInTimeZone } from "@/lib/timezone";
import { getDashboardKpis, KPI_DEFINITIONS } from "@/server/dashboard";
import { constellationRows, habitConsistencySeries } from "@/server/dashboard/habits";
import { getLayout } from "@/server/dashboard/widgets";
import { focusDailySeries } from "@/server/focus";
import { listHabits } from "@/server/habits";
import { listReviews } from "@/server/reviews";
import { getRegionalSettings } from "@/server/settings";

import { LayoutControls } from "./_components/layout-controls";
import { DashboardTabs } from "./_components/dashboard-tabs";
import { HabitConstellation } from "./_components/habit-constellation";
import { partitionQueue, QueueSplit } from "./_components/queue-split";
import { SignalTiles } from "./_components/signal-tiles";
import { TrendChart } from "./_components/trend-chart";

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

type PageProps = { searchParams: Promise<{ variant?: string }> };

/**
 * `/dashboard` (spec §6.8): four variants over one registry (ADR-046), translated per ADR-072. The
 * page only renders the widgets the user has visible, in their saved order; every number comes from
 * the module that owns it, and every KPI links to its source list.
 */
export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Dashboard");
  const tw = await getTranslations("Widgets");

  const { variant: requested } = await searchParams;
  const variant: DashboardVariant = DASHBOARD_VARIANTS.includes(requested as DashboardVariant)
    ? (requested as DashboardVariant)
    : "overview";

  const now = new Date();
  // The board must exist before the brief reads it; the rest of the page's reads are independent
  // of each other, so they go out together (ADR-101).
  await ensureSystemTasksBoard(session.user.id);
  const [layout, { timeZone, weekStart }] = await Promise.all([
    getLayout(session.user.id, variant),
    getRegionalSettings(session.user.id),
  ]);
  const visible = layout.widgets.filter((widget) => widget.visible).map((widget) => widget.id);
  const labels = Object.fromEntries(DASHBOARD_WIDGETS.map((widget) => [widget.id, tw(widget.key)]));

  const wantsHabits =
    variant === "overview" ||
    visible.some((id) => id === "today.pulse" || id === "today.habits" || id === "overview.wins");
  const [brief, kpis, habits, focusSeries, career, reviews] = await Promise.all([
    visible.some((id) => id.startsWith("today."))
      ? getDailyBrief(session.user.id, now, timeZone)
      : Promise.resolve(null),
    visible.some((id) => id.startsWith("overview.") || id.startsWith("productivity."))
      ? getDashboardKpis(session.user.id, now, timeZone, weekStart)
      : Promise.resolve(null),
    // The day key is passed in so the habits read does not re-resolve the timezone (ADR-099).
    wantsHabits
      ? listHabits(session.user.id, dayKeyInTimeZone(now, timeZone))
      : Promise.resolve([]),
    visible.includes("today.focus")
      ? focusDailySeries(session.user.id, 14, now, timeZone)
      : Promise.resolve([]),
    visible.some((id) => id.startsWith("career."))
      ? getCareerAnalytics(session.user.id, now, 21, timeZone, weekStart)
      : Promise.resolve(null),
    visible.includes("productivity.reviews") ? listReviews(session.user.id) : Promise.resolve([]),
  ]);
  const kpiById = new Map((kpis?.values ?? []).map((kpi) => [kpi.id, kpi]));

  // Chart series, each derived from the module that owns the rows behind it (ADR-101).
  const chartData = habitConsistencySeries(habits, 28);
  const pulseData = habitConsistencySeries(habits, 14);
  const focusData = focusSeries.map((row) => ({ day: row.day, value: row.minutes }));
  const constellation = constellationRows(
    habits.map((row) => ({
      id: row.habit.id,
      name: row.habit.name,
      streak: row.streak,
      days: row.days,
    })),
  );
  const queue = partitionQueue({
    overdue: brief?.overdue ?? [],
    dueToday: brief?.dueToday ?? [],
    inbox: brief?.inbox ?? [],
    openCards: brief?.openCards ?? 0,
  });
  const share = (count: number): number => (queue.total > 0 ? count / queue.total : 0);
  // How much of today's due work actually carries an estimate — a real ratio, not a capacity.
  const estimatedToday = (due: readonly { estimate_min: number | null }[]): number =>
    due.filter((card) => (card.estimate_min ?? 0) > 0).length;
  const estimatedShare = (due: readonly { estimate_min: number | null }[]): number =>
    due.length > 0 ? estimatedToday(due) / due.length : 0;

  const widgets: Record<string, React.ReactNode> = {
    "today.pulse": (
      <TrendChart
        data={pulseData}
        series="bar"
        title={t("pulseTitle")}
        description={t("pulseHint")}
        showTitle={false}
        caption={t("pulseCaption", { count: habits.length, days: 14 })}
        dayLabel={t("day")}
        valueLabel={t("doneShare")}
        unit="%"
        tableToggle={t("tableView")}
        emptyLabel={t("noHabits")}
        emptyAction={{ href: "/habits", label: t("openList") }}
        isEmpty={habits.length === 0}
      />
    ),
    "today.counts": brief ? (
      <SignalTiles
        items={[
          {
            id: "overdue",
            label: t("overdue"),
            value: brief.overdue.length,
            tone: brief.overdue.length > 0 ? "danger" : "muted",
            share: share(brief.overdue.length),
          },
          {
            id: "dueToday",
            label: t("dueToday"),
            value: brief.dueToday.length,
            tone: brief.dueToday.length > 0 ? "warning" : "muted",
            share: share(brief.dueToday.length),
          },
          {
            id: "inbox",
            label: t("inbox"),
            value: brief.inbox.length,
            tone: brief.inbox.length > 0 ? "info" : "muted",
            share: share(brief.inbox.length),
          },
        ]}
        meterLabel={(label) => t("shareOfOpen", { name: label })}
      />
    ) : null,
    "today.habits":
      constellation.length === 0 ? (
        <p className="font-mono text-xs text-muted-foreground">{t("noHabits")}</p>
      ) : (
        <HabitConstellation
          rows={constellation}
          doneOf={({ done, total }) => t("doneOf", { done, total })}
          streak={(count) => t("streak", { count })}
          freshStart={t("freshStart")}
        />
      ),
    "today.focus": (
      <TrendChart
        data={focusData}
        series="area"
        color="var(--chart-2)"
        title={t("focusTitle")}
        description={t("focusHint")}
        showTitle={false}
        caption={t("focusCaption")}
        dayLabel={t("day")}
        valueLabel={t("minutes")}
        unit={t("min")}
        tableToggle={t("tableView")}
        emptyLabel={t("noFocus")}
        emptyAction={{ href: "/focus", label: t("openList") }}
        isEmpty={focusSeries.every((row) => row.sessions === 0)}
      />
    ),
    "today.queue": brief ? (
      <QueueSplit
        partition={queue}
        labels={{
          overdue: t("overdue"),
          dueToday: t("dueToday"),
          inbox: t("inbox"),
          open: t("otherOpen"),
        }}
        emptyLabel={t("nothingOpen")}
      />
    ) : null,
    "today.planned": brief ? (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="font-mono text-xl font-semibold tabular-nums">
          {brief.estimatedMinutesToday}
          <span className="ml-1 text-[10px] font-normal text-muted-foreground uppercase">
            {t("min")}
          </span>
        </p>
        <div className="flex flex-col gap-0.5">
          <AsciiMeter
            value={estimatedShare(brief.dueToday)}
            label={t("estimateCoverage")}
            cells={12}
            showValue={false}
            className="text-[10px]"
          />
          <span className="font-mono text-[10px] text-muted-foreground">
            {t("estimateCoverageHint", { count: estimatedToday(brief.dueToday) })}
          </span>
        </div>
      </div>
    ) : null,
    "today.top3": brief ? (
      brief.top.length === 0 ? (
        <p className="font-mono text-xs text-muted-foreground">{t("nothingOpen")}</p>
      ) : (
        <ol className="flex flex-col gap-1.5" data-slot="today-top3">
          {brief.top.map((card, index) => (
            <li
              key={card.id}
              data-slot="today-top3-row"
              className="flex min-w-0 items-center gap-2"
            >
              <span
                aria-hidden="true"
                className="w-5 shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  card.priority === "p0"
                    ? "bg-destructive"
                    : card.priority === "p1"
                      ? "bg-warning"
                      : "bg-muted-foreground",
                )}
              />
              <Link
                href={`/tasks?card=${card.id}`}
                className="min-w-0 flex-1 truncate font-mono text-xs hover:text-primary"
              >
                {card.title}
              </Link>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {card.priority ? card.priority : "—"}
              </span>
            </li>
          ))}
        </ol>
      )
    ) : null,
    "overview.kpis": kpis ? (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.values.map((kpi) => {
          const definition = KPI_DEFINITIONS[kpi.id];
          return (
            <StatCard
              key={kpi.id}
              slot="kpi-card"
              data-kpi={kpi.id}
              label={t(`kpi_${kpi.id}`)}
              value={renderValue(kpi.value, kpi.unit)}
              delta={kpi.delta}
              meter={
                kpi.id === "habitConsistency" && kpi.value !== null
                  ? Math.min(1, Math.max(0, kpi.value / 100))
                  : undefined
              }
              {...(definition ? { href: definition.href, linkLabel: t("openList") } : {})}
            />
          );
        })}
      </div>
    ) : null,
    "overview.wins": (
      <ul className="flex flex-col gap-1 font-mono text-xs">
        {habits.length === 0 ? (
          <li className="text-muted-foreground">{t("noHabits")}</li>
        ) : (
          habits.map((row) => {
            const done = row.days.filter((day) => day.done).length;
            const ratio = row.days.length > 0 ? done / row.days.length : 0;
            return (
              <li key={row.habit.id} data-slot="streak-row" className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{row.habit.name}</span>
                <AsciiMeter value={ratio} label={row.habit.name} cells={14} showValue={false} />
                <span className="w-24 text-right text-muted-foreground tabular-nums">
                  {row.streak > 0 ? t("streak", { count: row.streak }) : t("freshStart")}
                </span>
              </li>
            );
          })
        )}
      </ul>
    ),
    "career.funnel": career ? (
      <ul className="flex flex-col gap-1 font-mono text-xs">
        {career.funnel.stages.map((stage) => (
          <li key={stage.stage} data-slot="funnel-widget-row" className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate">{stage.stage}</span>
            <span className="tabular-nums">{stage.count}</span>
            <span className="text-muted-foreground tabular-nums">
              {stage.averageDaysInStage === null ? "—" : `${stage.averageDaysInStage}d`}
            </span>
          </li>
        ))}
      </ul>
    ) : null,
    "career.open": kpis ? (
      <p className="font-mono text-xs tabular-nums">
        {t("openCount", { count: kpiById.get("openApplications")?.value ?? 0 })}
      </p>
    ) : null,
    "career.analytics": career ? (
      <ul className="flex flex-col gap-1 font-mono text-xs">
        {career.bySource.map((row) => (
          <li key={row.source} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate">{row.source}</span>
            <span className="tabular-nums">{row.total}</span>
            <span className="text-muted-foreground tabular-nums">
              {Math.round(row.rate * 100)}%
            </span>
          </li>
        ))}
      </ul>
    ) : null,
    "productivity.kpis": kpis ? (
      <dl className="flex flex-wrap gap-4 font-mono text-xs">
        <div className="flex items-center gap-1">
          <dt className="text-muted-foreground">{t("tasksDone")}</dt>
          <dd className="tabular-nums">{kpiById.get("tasksDoneThisWeek")?.value ?? 0}</dd>
        </div>
        <div className="flex items-center gap-1">
          <dt className="text-muted-foreground">{t("focus")}</dt>
          <dd className="tabular-nums">
            {kpiById.get("focusMinutesThisWeek")?.value ?? 0} {t("min")}
          </dd>
        </div>
      </dl>
    ) : null,
    "productivity.focus": kpis ? (
      <p className="font-mono text-xs tabular-nums">
        {renderValue(kpiById.get("focusMinutesThisWeek")?.value ?? 0, t("min"))} {t("thisWeek")}
      </p>
    ) : null,
    "productivity.reviews": (
      <p className="font-mono text-xs tabular-nums">
        {t("reviewsLogged", { count: reviews.length })}
      </p>
    ),
  };

  return (
    <>
      <PageHeader title={t("title")}>
        <DashboardTabs variant={variant} variants={DASHBOARD_VARIANTS} />
      </PageHeader>

      <div className="grid gap-4">
        {variant === "overview" && chartData.length > 0 ? (
          <Panel title={t("chartTitle")}>
            <TrendChart
              data={chartData}
              series="bar"
              title={t("chartTitle")}
              description={t("chartHint")}
              showTitle={false}
              caption={t("pulseCaption", { count: habits.length, days: 28 })}
              dayLabel={t("day")}
              valueLabel={t("doneShare")}
              unit="%"
              tableToggle={t("tableView")}
              emptyLabel={t("noHabits")}
              emptyAction={{ href: "/habits", label: t("openList") }}
              isEmpty={habits.length === 0}
            />
          </Panel>
        ) : null}

        {layout.widgets
          .filter((widget) => widget.visible)
          .map((widget) => (
            <Panel key={widget.id} title={labels[widget.id] ?? widget.id}>
              {widgets[widget.id] ?? (
                <p className="font-mono text-xs text-muted-foreground">{t("nothingToShow")}</p>
              )}
            </Panel>
          ))}

        <details className="group" data-slot="dashboard-customize">
          <summary className="w-fit cursor-pointer rounded-[var(--radius)] border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground select-none hover:bg-accent hover:text-accent-foreground">
            {t("customize")}
          </summary>
          <div className="mt-2">
            <Panel title={t("layout")}>
              <LayoutControls layout={layout} labels={labels} />
            </Panel>
          </div>
        </details>
      </div>
    </>
  );
}
