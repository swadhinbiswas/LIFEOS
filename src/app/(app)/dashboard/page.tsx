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
import { activitySeries, getConnection, topAcross } from "@/server/activity/wakatime";
import { briefEnabled, latestBrief } from "@/server/ai/brief";
import { getDashboardKpis, KPI_DEFINITIONS } from "@/server/dashboard";
import { completedDailySeries } from "@/server/dashboard/completion";
import { templatesForVariant } from "@/config/dashboard-templates";
import { constellationRows, habitConsistencySeries } from "@/server/dashboard/habits";
import { getLayout } from "@/server/dashboard/widgets";
import { focusDailySeries } from "@/server/focus";
import { listHabits } from "@/server/habits";
import { listReviews } from "@/server/reviews";
import { reviewStreak } from "@/server/reviews/streak";
import { getRegionalSettings } from "@/server/settings";
import { getCalendar } from "@/server/calendar";
import { buildSchedule } from "@/server/dashboard/schedule";
import { getRunningSession } from "@/server/focus";
import { CaptureBox } from "../_components/board/capture-box";
import { FocusTimer } from "../focus/_components/focus-timer";

import { AiBriefPanel } from "./_components/ai-brief";
import { DayHeader } from "./_components/day-header";
import { ScheduleStripView } from "./_components/schedule-strip";
import { LayoutControls } from "./_components/layout-controls";
import { DashboardTabs } from "./_components/dashboard-tabs";
import { FunnelChart } from "./_components/funnel-chart";
import { HabitConstellation } from "./_components/habit-constellation";
import { partitionQueue, QueueSplit } from "./_components/queue-split";
import { SignalTiles } from "./_components/signal-tiles";
import { TemplatePicker } from "./_components/template-picker";
import { StaleApplications } from "./_components/stale-applications";
import { TrendChart } from "./_components/trend-chart";

import { pageMetadata } from "@/lib/page-metadata";

export async function generateMetadata() {
  return pageMetadata("Pages.Dashboard", "title");
}

/**
 * How many days the code variant charts. Matches the window the sync action pulls, so the chart and
 * the cache cannot disagree about what exists (ADR-110).
 */
const ACTIVITY_WINDOW_DAYS = 30;

const money = (minor: number, unit: string | null): string => {
  const whole = (minor / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return unit ? `${whole} ${unit}` : whole;
};

const renderValue = (value: number | null, unit: string | null): string => {
  if (value === null) return "—";
  if (unit && /^[A-Z]{3}$/u.test(unit)) return money(value, unit);
  return unit ? `${value} ${unit}` : String(value);
};

/** Hours from seconds, at the precision a glance needs — `1.5h`, not `1:30:00`. */
const hours = (seconds: number): string => `${Math.round((seconds / 3600) * 10) / 10}h`;

/**
 * A provider's own top-N breakdown as meters (ADR-110). Zero rows render the caller's empty state
 * rather than a stack of empty meters — a breakdown with nothing in it is a fact, not a chart.
 */
function BreakdownList({
  rows,
  format,
  meterLabel,
  emptyLabel,
  emptyAction,
}: {
  rows: Array<{ name: string; seconds: number }>;
  format: (seconds: number) => string;
  meterLabel: (name: string) => string;
  emptyLabel: string;
  emptyAction?: { href: string; label: string };
}) {
  if (rows.length === 0) {
    return (
      <div className="grid gap-1">
        <p className="font-mono text-xs text-muted-foreground">{emptyLabel}</p>
        {emptyAction ? (
          <Link
            href={emptyAction.href}
            className="w-fit font-mono text-[10px] text-primary hover:underline"
          >
            {emptyAction.label}
          </Link>
        ) : null}
      </div>
    );
  }

  const busiest = Math.max(1, ...rows.map((row) => row.seconds));
  return (
    <ul className="flex min-w-0 flex-col gap-1.5" data-slot="breakdown-list">
      {rows.map((row) => (
        <li key={row.name} data-slot="breakdown-row" className="flex items-center gap-2">
          <span className="w-28 shrink-0 truncate font-mono text-xs" title={row.name}>
            {row.name}
          </span>
          <AsciiMeter
            value={row.seconds / busiest}
            label={meterLabel(row.name)}
            cells={10}
            showValue={false}
            className="text-[10px]"
          />
          <span className="font-mono text-xs tabular-nums">{format(row.seconds)}</span>
        </li>
      ))}
    </ul>
  );
}

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
  // Career vocabulary (stage / in stage / mean days / no jobs) is the analytics page's own copy, so
  // it is reused rather than duplicated — a second copy is a second thing to keep in sync.
  const tc = await getTranslations("Pages.Career");
  const tt = await getTranslations("Widgets.templates");

  const { variant: requested } = await searchParams;
  const variant: DashboardVariant = DASHBOARD_VARIANTS.includes(requested as DashboardVariant)
    ? (requested as DashboardVariant)
    : "overview";

  const now = new Date();
  // The board must exist before the brief reads it, and quick capture needs its id. One call either
  // way: `ensureSystemTasksBoard` is idempotent, and the rest of the page's reads are independent of
  // it, so they go out together (ADR-101).
  const tasksBoard = await ensureSystemTasksBoard(session.user.id);
  const [layout, { timeZone, weekStart }] = await Promise.all([
    getLayout(session.user.id, variant),
    getRegionalSettings(session.user.id),
  ]);
  const visible = layout.widgets.filter((widget) => widget.visible).map((widget) => widget.id);
  const labels = Object.fromEntries(DASHBOARD_WIDGETS.map((widget) => [widget.id, tw(widget.key)]));

  const wantsHabits =
    variant === "overview" ||
    visible.some((id) => id === "today.pulse" || id === "today.habits" || id === "overview.wins");
  const wantsFocus = visible.includes("today.focus") || visible.includes("productivity.focus");
  const wantsSchedule = visible.includes("today.schedule");
  const wantsTimer = visible.includes("today.timer");
  const wantsKpis =
    visible.some((id) => id.startsWith("overview.") || id.startsWith("productivity.")) ||
    visible.includes("career.open");
  // The user's day key, resolved once and passed to every read that buckets by day (ADR-099).
  const todayKey = dayKeyInTimeZone(now, timeZone);
  const [
    brief,
    kpis,
    habits,
    focusSeries,
    todayEvents,
    runningSession,
    career,
    reviews,
    doneSeries,
    aiBrief,
    aiBriefOn,
    activity,
    activityConnection,
  ] = await Promise.all([
    visible.some((id) => id.startsWith("today."))
      ? getDailyBrief(session.user.id, now, timeZone)
      : Promise.resolve(null),
    // `career.open` needs this too: without it the widget used to render a placeholder (ADR-104).
    wantsKpis ? getDashboardKpis(session.user.id, now, timeZone, weekStart) : Promise.resolve(null),
    // The day key is passed in so the habits read does not re-resolve the timezone (ADR-099).
    wantsHabits
      ? listHabits(session.user.id, dayKeyInTimeZone(now, timeZone))
      : Promise.resolve([]),
    wantsFocus ? focusDailySeries(session.user.id, 14, now, timeZone) : Promise.resolve([]),
    // The day itself: the same calendar read the calendar page makes, narrowed to today, so the
    // strip and the calendar can never disagree about what is scheduled.
    wantsSchedule
      ? getCalendar(session.user.id, { from: todayKey, to: todayKey }, timeZone)
      : Promise.resolve([]),
    // Only the running session, not the series: the timer needs an id and a start, nothing else.
    wantsTimer ? getRunningSession(session.user.id) : Promise.resolve(null),
    visible.some((id) => id.startsWith("career."))
      ? getCareerAnalytics(session.user.id, now, 21, timeZone, weekStart)
      : Promise.resolve(null),
    // 52 rows is a year of weeks, which is the window a streak can actually reach.
    visible.includes("productivity.reviews")
      ? listReviews(session.user.id, 52)
      : Promise.resolve([]),
    visible.includes("productivity.done")
      ? completedDailySeries(session.user.id, 14, now, timeZone)
      : Promise.resolve([]),
    visible.includes("today.brief") ? latestBrief(session.user.id, now) : Promise.resolve(null),
    visible.includes("today.brief") ? briefEnabled(session.user.id) : Promise.resolve(false),
    // Coding activity is a cache of a remote provider (ADR-110), so this is a plain local read
    // and the page never waits on the network to draw a chart.
    visible.some((id) => id.startsWith("code."))
      ? activitySeries(session.user.id, ACTIVITY_WINDOW_DAYS, now, timeZone)
      : Promise.resolve([]),
    visible.includes("code.connection") ? getConnection(session.user.id) : Promise.resolve(null),
  ]);
  const kpiById = new Map((kpis?.values ?? []).map((kpi) => [kpi.id, kpi]));

  // Chart series, each derived from the module that owns the rows behind it (ADR-101/ADR-104).
  const chartData = habitConsistencySeries(habits, 28);
  const pulseData = habitConsistencySeries(habits, 14);
  const focusData = focusSeries.map((row) => ({ day: row.day, value: row.minutes }));
  const doneData = doneSeries.map((row) => ({ day: row.day, value: row.count }));
  const reviewWeeks = reviewStreak(reviews, now, timeZone, weekStart);
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

  // The day laid out in time (spec §6.8), derived from the same events the calendar page reads.
  const schedule = buildSchedule(todayEvents, now, timeZone);

  // Coding activity (ADR-110). Every figure is WakaTime's own number, passed through; the only
  // thing computed here is the unit change (seconds to minutes) and the net line change.
  const codingData = activity.map((row) => ({ day: row.day, value: Math.round(row.seconds / 60) }));
  const aiLinesData = activity.map((row) => ({
    day: row.day,
    value: row.aiAdditions - row.aiDeletions,
    human: row.humanAdditions - row.humanDeletions,
  }));
  const codingMinutes = activity.reduce((sum, row) => sum + row.seconds, 0) / 60;
  const activeDays = activity.filter((row) => row.seconds > 0).length;
  const bestDay = activity.reduce((max, row) => Math.max(max, row.seconds), 0);
  const aiLines = activity.reduce((sum, row) => sum + (row.aiAdditions - row.aiDeletions), 0);
  const humanLines = activity.reduce(
    (sum, row) => sum + (row.humanAdditions - row.humanDeletions),
    0,
  );
  const aiCost = activity.reduce((sum, row) => sum + row.aiCostUsd, 0);
  const languageTotals = topAcross(activity, "languages", 6);
  const editorTotals = topAcross(activity, "editors", 5);
  const projectTotals = topAcross(activity, "projects", 5);
  const share = (count: number): number => (queue.total > 0 ? count / queue.total : 0);
  // How much of today's due work actually carries an estimate — a real ratio, not a capacity.
  const estimatedToday = (due: readonly { estimate_min: number | null }[]): number =>
    due.filter((card) => (card.estimate_min ?? 0) > 0).length;
  const estimatedShare = (due: readonly { estimate_min: number | null }[]): number =>
    due.length > 0 ? estimatedToday(due) / due.length : 0;
  // Open applications as a share of everything the pipeline has ever held.
  const shareOpen = (total: number, open: number): number => (total > 0 ? open / total : 0);

  const widgets: Record<string, React.ReactNode> = {
    "today.brief": (
      <AiBriefPanel
        brief={
          aiBrief
            ? {
                title: aiBrief.title,
                body: aiBrief.body,
                createdAt: aiBrief.createdAt,
                isToday: aiBrief.isToday,
              }
            : null
        }
        enabled={aiBriefOn}
        labels={{
          regenerate: t("briefRegenerate"),
          regenerating: t("briefRegenerating"),
          stale: t("briefStale"),
          noBrief: t("briefNone"),
          noBriefHint: t("briefNoneHint"),
          enableLink: t("briefEnable"),
          regenerateLink: t("briefOpenSettings"),
          aiSettings: t("briefAsk"),
        }}
      />
    ),
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
                className="flex min-h-8 min-w-0 flex-1 items-center truncate font-mono
                  text-xs hover:text-primary"
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
      <FunnelChart
        data={career.funnel.stages.map((stage) => ({
          stage: stage.stage,
          count: stage.count,
          meanDays: stage.averageDaysInStage,
        }))}
        title={t("funnelTitle")}
        description={t("funnelHint2", { total: career.funnel.total })}
        stageLabel={tc("stage")}
        countLabel={tc("inStage")}
        meanLabel={tc("meanDays")}
        tableToggle={t("tableView")}
        emptyLabel={tc("noJobs")}
        emptyAction={{ href: "/career/jobs", label: t("addJobLink") }}
        caption={t("funnelMoved", {
          responded: career.funnel.responded,
          sent: career.funnel.sent,
        })}
      />
    ) : null,
    "career.velocity": career ? (
      <TrendChart
        data={career.perWeek.map((week) => ({ day: week.weekStart, value: week.count }))}
        series="bar"
        title={t("velocityTitle")}
        description={t("velocityHint", { weeks: career.perWeek.length })}
        showTitle={false}
        caption={t("velocityCaption", { total: career.funnel.total })}
        dayLabel={t("week")}
        valueLabel={t("applications")}
        tableToggle={t("tableView")}
        emptyLabel={t("noApplications")}
        isEmpty={career.funnel.total === 0}
      />
    ) : null,
    "career.stale": career ? (
      <StaleApplications
        rows={career.ghosted.slice(0, 6).map((row) => ({
          cardId: row.cardId,
          title: row.title,
          stage: row.stage,
          days: row.days,
        }))}
        thresholdDays={career.ghostThresholdDays}
        daysLabel={(count) => t("daysInStage", { count })}
        meterLabel={({ title, days }) => t("staleMeter", { name: title, count: days })}
        emptyLabel={t("nothingStale")}
      />
    ) : null,
    "career.open": (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="font-mono text-2xl leading-none font-semibold tabular-nums">
          {kpiById.get("openApplications")?.value ?? 0}
        </p>
        <div className="flex flex-col gap-0.5">
          <AsciiMeter
            value={shareOpen(
              career?.funnel.total ?? 0,
              kpiById.get("openApplications")?.value ?? 0,
            )}
            label={t("openShareLabel")}
            cells={14}
            showValue={false}
            className="text-[10px]"
          />
          <span className="font-mono text-[10px] text-muted-foreground">
            {t("openShareHint", { total: career?.funnel.total ?? 0 })}
          </span>
        </div>
        <Link
          href="/career/jobs"
          className="inline-flex min-h-6 items-center font-mono text-[10px] text-primary hover:underline"
        >
          {t("openList")}
        </Link>
      </div>
    ),
    "career.analytics": career ? (
      <ul className="flex min-w-0 flex-col gap-1.5" data-slot="source-list">
        {career.bySource.map((row) => {
          const busiest = Math.max(1, ...career.bySource.map((entry) => entry.total));
          return (
            <li key={row.source} data-slot="source-row" className="flex items-center gap-2">
              <span className="min-w-0 w-28 shrink-0 truncate font-mono text-xs">{row.source}</span>
              <AsciiMeter
                value={row.total / busiest}
                label={t("sourceMeter", { name: row.source })}
                cells={10}
                showValue={false}
                className="text-[10px]"
              />
              <span className="font-mono text-xs tabular-nums">{row.total}</span>
              <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                {Math.round(row.rate * 100)}%
              </span>
            </li>
          );
        })}
      </ul>
    ) : null,
    "productivity.kpis": kpis ? (
      <SignalTiles
        items={[
          {
            id: "tasksDone",
            label: t("tasksDone"),
            value: kpiById.get("tasksDoneThisWeek")?.value ?? 0,
            tone: "muted",
          },
          {
            id: "focus",
            label: t("focus"),
            value: kpiById.get("focusMinutesThisWeek")?.value ?? 0,
            tone: "muted",
            suffix: t("min"),
          },
          {
            id: "habitConsistency",
            label: t("kpi_habitConsistency"),
            value: kpiById.get("habitConsistency")?.value ?? 0,
            tone: "muted",
            suffix: "%",
          },
          {
            id: "activeGoals",
            label: t("kpi_activeGoals"),
            value: kpiById.get("activeGoals")?.value ?? 0,
            tone: "muted",
          },
        ]}
        meterLabel={(label) => t("kpiValue", { name: label })}
      />
    ) : null,
    "productivity.done": (
      <TrendChart
        data={doneData}
        series="bar"
        title={t("doneTitle")}
        description={t("doneHint")}
        showTitle={false}
        caption={t("doneCaption", {
          minutes: doneSeries.reduce((sum, row) => sum + row.minutes, 0),
        })}
        dayLabel={t("day")}
        valueLabel={t("cards")}
        tableToggle={t("tableView")}
        emptyLabel={t("noDone")}
        isEmpty={doneSeries.every((row) => row.count === 0)}
      />
    ),
    "productivity.focus": (
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
        isEmpty={focusSeries.every((row) => row.sessions === 0)}
      />
    ),
    "today.schedule": (
      <ScheduleStripView
        strip={schedule}
        labels={{
          emptyLabel: t("scheduleEmpty"),
          emptyHint: t("scheduleEmptyHint"),
          emptyActionLabel: t("openCalendar"),
          now: t("scheduleNow"),
          next: t("scheduleNext"),
          untimed: t("scheduleUntimed"),
          untimedEmpty: t("scheduleUntimedEmpty"),
          openCalendar: t("openCalendar"),
          blockLabel: (time, title, state) => t("scheduleBlockLabel", { time, title, state }),
          statePast: t("scheduleStatePast"),
          stateNow: t("scheduleStateNow"),
          stateNext: t("scheduleStateNext"),
        }}
      />
    ),
    "today.capture": tasksBoard ? <CaptureBox boardId={tasksBoard.id} /> : null,
    "today.timer": (
      <FocusTimer
        sessionId={runningSession?.id ?? null}
        startedAt={runningSession ? runningSession.started_at.toISOString() : null}
        plannedMin={runningSession?.planned_min ?? null}
      />
    ),
    "productivity.reviews": (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="font-mono text-2xl leading-none font-semibold tabular-nums">
          {reviewWeeks}
          <span className="ml-1 text-[10px] font-normal text-muted-foreground uppercase">
            {t("weekStreakShort")}
          </span>
        </p>
        <p className="font-mono text-[10px] text-muted-foreground">
          {t("reviewsLogged", { count: reviews.length })}
        </p>
        <Link
          href="/reviews"
          className="inline-flex min-h-6 items-center font-mono text-[10px] text-primary hover:underline"
        >
          {t("openList")}
        </Link>
      </div>
    ),

    // Coding activity (ADR-110). Every value below is the number WakaTime reported for the day;
    // nothing is estimated, and an unconnected account gets a way in rather than an empty chart.
    "code.kpis": (
      <SignalTiles
        items={[
          {
            id: "codingTime",
            label: t("kpi_codingTime"),
            value: Math.round(codingMinutes),
            tone: "muted",
            suffix: t("min"),
          },
          {
            id: "activeDays",
            label: t("kpi_activeDays"),
            value: activeDays,
            tone: "muted",
            suffix: t("days_short"),
          },
          {
            id: "bestDay",
            label: t("kpi_bestDay"),
            value: Math.round(bestDay / 60),
            tone: "muted",
            suffix: t("hours_short"),
          },
          {
            id: "aiCost",
            label: t("kpi_aiCost"),
            value: Math.round(aiCost * 100) / 100,
            tone: "muted",
            suffix: t("usd"),
          },
        ]}
        meterLabel={(label) => t("kpiMeter", { name: label })}
      />
    ),
    "code.time": (
      <TrendChart
        data={codingData}
        series="bar"
        color="var(--chart-1)"
        title={t("codingTimeTitle")}
        description={t("codingTimeHint", { days: ACTIVITY_WINDOW_DAYS })}
        showTitle={false}
        caption={t("codingTimeCaption", {
          days: activeDays,
          hours: Math.round(codingMinutes / 6) / 10,
        })}
        dayLabel={t("day")}
        valueLabel={t("minutes")}
        unit={t("min")}
        tableToggle={t("tableView")}
        emptyLabel={
          activityConnection ? t("noCodingYet", { days: ACTIVITY_WINDOW_DAYS }) : t("notConnected")
        }
        emptyAction={
          activityConnection
            ? { href: "/settings/activity", label: t("syncNow") }
            : { href: "/settings/activity", label: t("connect") }
        }
        isEmpty={codingData.length === 0}
      />
    ),
    "code.ai": (
      <TrendChart
        data={aiLinesData}
        series="bar"
        color="var(--chart-2)"
        secondary={{ dataKey: "human", label: t("humanLines"), color: "var(--chart-3)" }}
        title={t("aiLinesTitle")}
        description={t("aiLinesHint")}
        showTitle={false}
        caption={t("aiLinesCaption", { ai: aiLines, human: humanLines })}
        dayLabel={t("day")}
        valueLabel={t("aiLines")}
        unit={t("lines")}
        tableToggle={t("tableView")}
        emptyLabel={
          activityConnection ? t("noAiLines", { days: ACTIVITY_WINDOW_DAYS }) : t("notConnected")
        }
        emptyAction={{
          href: "/settings/activity",
          label: activityConnection ? t("syncNow") : t("connect"),
        }}
        isEmpty={aiLinesData.length === 0}
      />
    ),
    "code.languages": (
      <BreakdownList
        rows={languageTotals}
        format={hours}
        meterLabel={(name) => t("languageMeter", { name })}
        emptyLabel={activityConnection ? t("noLanguages") : t("notConnected")}
        emptyAction={{
          href: "/settings/activity",
          label: activityConnection ? t("syncNow") : t("connect"),
        }}
      />
    ),
    "code.harnesses": (
      <div className="grid gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
            {t("editorsLabel")}
          </p>
          <div className="mt-1.5">
            <BreakdownList
              rows={editorTotals}
              format={hours}
              meterLabel={(name) => t("editorMeter", { name })}
              emptyLabel={t("noEditors")}
            />
          </div>
        </div>
        <div>
          <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
            {t("projectsLabel")}
          </p>
          <div className="mt-1.5">
            <BreakdownList
              rows={projectTotals}
              format={hours}
              meterLabel={(name) => t("projectMeter", { name })}
              emptyLabel={t("noProjects")}
            />
          </div>
        </div>
      </div>
    ),
    "code.connection": (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="font-mono text-[10px] text-muted-foreground">
          {activityConnection
            ? t("connectedAs", { hint: activityConnection.hint })
            : t("notConnectedShort")}
        </p>
        <p className="font-mono text-[10px] text-muted-foreground">
          {activityConnection?.lastSyncedAt
            ? t("syncedAt", {
                when: activityConnection.lastSyncedAt.toLocaleString(),
              })
            : t("neverSynced")}
        </p>
        {activityConnection?.lastError ? (
          <p role="status" className="font-mono text-[10px] text-destructive">
            {activityConnection.lastError}
          </p>
        ) : null}
        <Link
          href="/settings/activity"
          className="inline-flex min-h-6 items-center font-mono text-[10px] text-primary hover:underline"
        >
          {t("connectionSettings")}
        </Link>
      </div>
    ),
  };

  return (
    <>
      <PageHeader title={t("title")}>
        <DashboardTabs variant={variant} variants={DASHBOARD_VARIANTS} />
      </PageHeader>

      <div className="grid gap-4">
        {/* Spec §6.8 asks Today for a greeting and a date. It is the variant's own heading, so it
            sits above the widgets rather than inside a Panel — a chip around a greeting would be
            a frame around a sentence. */}
        {variant === "today" ? (
          <DayHeader
            name={session.user.name ?? null}
            day={todayKey}
            timeZone={timeZone}
            now={now}
          />
        ) : null}

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
              <TemplatePicker
                variant={variant}
                templates={templatesForVariant(variant).map((template) => ({
                  id: template.id,
                  label: tt(template.key),
                  hint: tt(template.hintKey),
                }))}
              />
            </Panel>
          </div>
        </details>
      </div>
    </>
  );
}
