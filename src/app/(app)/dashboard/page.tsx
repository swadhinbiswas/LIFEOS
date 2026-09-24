import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { getServerSession } from "@/server/auth/session";
import { ensureSystemTasksBoard } from "@/server/boards";
import { getDailyBrief } from "@/server/boards/brief";
import { getCareerAnalytics } from "@/server/career/analytics";
import {
  DASHBOARD_VARIANTS,
  DASHBOARD_WIDGETS,
  type DashboardVariant,
} from "@/config/dashboard-widgets";
import { getDashboardKpis, KPI_DEFINITIONS } from "@/server/dashboard";
import { getLayout } from "@/server/dashboard/widgets";
import { listHabits } from "@/server/habits";
import { listReviews } from "@/server/reviews";
import { getRegionalSettings } from "@/server/settings";

import { LayoutControls } from "./_components/layout-controls";

export const metadata = { title: "Dashboard" };

const VARIANT_KEY: Record<DashboardVariant, string> = {
  today: "variantToday",
  overview: "variantOverview",
  career: "variantCareer",
  productivity: "variantProductivity",
};

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

  await ensureSystemTasksBoard(session.user.id);
  const layout = await getLayout(session.user.id, variant);
  const visible = layout.widgets.filter((widget) => widget.visible).map((widget) => widget.id);
  const labels = Object.fromEntries(DASHBOARD_WIDGETS.map((widget) => [widget.id, tw(widget.key)]));

  const { timeZone, weekStart } = await getRegionalSettings(session.user.id);
  const brief = visible.some((id) => id.startsWith("today."))
    ? await getDailyBrief(session.user.id, new Date(), timeZone)
    : null;
  const kpis = visible.some((id) => id.startsWith("overview.") || id.startsWith("productivity."))
    ? await getDashboardKpis(session.user.id, new Date(), timeZone, weekStart)
    : null;
  const habits = visible.includes("overview.wins") ? await listHabits(session.user.id) : [];
  const career = visible.some((id) => id.startsWith("career."))
    ? await getCareerAnalytics(session.user.id, new Date(), 21, timeZone, weekStart)
    : null;
  const reviews = visible.includes("productivity.reviews")
    ? await listReviews(session.user.id)
    : [];
  const kpiById = new Map((kpis?.values ?? []).map((kpi) => [kpi.id, kpi]));

  const widgets: Record<string, React.ReactNode> = {
    "today.counts": brief ? (
      <dl className="flex flex-wrap gap-4 font-mono text-[10px] uppercase">
        <div className="flex items-center gap-1">
          <dt className="text-muted-foreground">{t("overdue")}</dt>
          <dd className={brief.overdue.length > 0 ? "text-warning" : "text-muted-foreground"}>
            {brief.overdue.length}
          </dd>
        </div>
        <div className="flex items-center gap-1">
          <dt className="text-muted-foreground">{t("dueToday")}</dt>
          <dd className="text-muted-foreground">{brief.dueToday.length}</dd>
        </div>
        <div className="flex items-center gap-1">
          <dt className="text-muted-foreground">{t("inbox")}</dt>
          <dd className="text-muted-foreground">{brief.inbox.length}</dd>
        </div>
      </dl>
    ) : null,
    "today.planned": brief ? (
      <p className="font-mono text-xs tabular-nums">
        {t("minPlanned", { count: brief.estimatedMinutesToday })}
      </p>
    ) : null,
    "today.top3": brief ? (
      brief.top.length === 0 ? (
        <p className="font-mono text-xs text-muted-foreground">{t("nothingOpen")}</p>
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
      )
    ) : null,
    "overview.kpis": kpis ? (
      <table className="w-full border-collapse font-mono text-xs">
        <caption className="sr-only">{t("kpiCaption")}</caption>
        <tbody>
          {kpis.values.map((kpi) => {
            const definition = KPI_DEFINITIONS[kpi.id];
            return (
              <tr key={kpi.id} data-slot="kpi-row" data-kpi={kpi.id}>
                <th scope="row" className="border-b border-border px-2 py-1 text-left font-normal">
                  <span title={t(`kpiDef_${kpi.id}`)}>{t(`kpi_${kpi.id}`)}</span>
                </th>
                <td className="border-b border-border px-2 py-1 text-right tabular-nums">
                  {renderValue(kpi.value, kpi.unit)}
                </td>
                <td className="border-b border-border px-2 py-1 text-right tabular-nums text-muted-foreground">
                  {kpi.delta === null ? "—" : `${kpi.delta > 0 ? "+" : ""}${kpi.delta}`}
                </td>
                <td className="border-b border-border px-2 py-1">
                  {definition ? (
                    <Link href={definition.href} className="text-primary hover:underline">
                      {t("openList")}
                    </Link>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    ) : null,
    "overview.wins": (
      <ul className="flex flex-col gap-1 font-mono text-xs">
        {habits.length === 0 ? (
          <li className="text-muted-foreground">{t("noHabits")}</li>
        ) : (
          habits.map((row) => (
            <li key={row.habit.id} data-slot="streak-row" className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{row.habit.name}</span>
              <span className="text-muted-foreground">
                {row.streak > 0 ? t("streak", { count: row.streak }) : t("freshStart")}
              </span>
            </li>
          ))
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
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">
        {t("title")}
      </h1>

      <nav aria-label={t("title")} className="mb-4 flex flex-wrap gap-1 font-mono text-[10px]">
        {DASHBOARD_VARIANTS.map((option) => (
          <Link
            key={option}
            href={`/dashboard?variant=${option}`}
            aria-current={option === variant ? "page" : undefined}
            className={
              option === variant
                ? "rounded-[var(--radius)] border border-primary bg-primary px-2 py-0.5 text-primary-foreground"
                : "rounded-[var(--radius)] border border-border px-2 py-0.5 hover:bg-accent hover:text-accent-foreground"
            }
          >
            {t(VARIANT_KEY[option])}
          </Link>
        ))}
      </nav>

      <div className="grid max-w-4xl gap-4">
        <Panel title={t("layout")}>
          <LayoutControls layout={layout} labels={labels} />
        </Panel>

        {layout.widgets
          .filter((widget) => widget.visible)
          .map((widget) => (
            <Panel key={widget.id} title={labels[widget.id] ?? widget.id}>
              {widgets[widget.id] ?? (
                <p className="font-mono text-xs text-muted-foreground">{t("nothingToShow")}</p>
              )}
            </Panel>
          ))}
      </div>
    </>
  );
}
