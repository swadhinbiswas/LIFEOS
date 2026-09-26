import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Table } from "@/components/ui/table";
import { EmptyState } from "@/components/tui/empty-state";
import { AsciiMeter } from "@/components/tui/ascii-meter";
import { listJobApplications, type JobRow } from "@/server/career/applications";

/**
 * The applications database (ADR-126): every field, one row each, sortable and filterable — the view
 * the reference tracker is actually good at, and the one the pipeline board cannot be.
 *
 * The board answers "what needs moving"; this answers "what do I have". Those are different
 * questions and the columns here are chosen for the second one: the identifying fields you would
 * quote to a recruiter, the money, the fit, and the promise you made and when it is owed.
 *
 * Sorting and filtering are URL state, so a filtered view is a link you can send someone or keep in
 * a bookmark — the same reason the board's filters are URL state (ADR-042).
 */
export async function JobDatabase({
  userId,
  sort,
  stage,
  fit,
}: {
  userId: string;
  sort: string | undefined;
  stage: string | undefined;
  fit: string | undefined;
}) {
  const t = await getTranslations("Pages.Career");
  const all = await listJobApplications(userId);

  // Filtering here rather than in SQL keeps the column list readable and the stage list honest: the
  // stages are board columns, and a stage that no longer exists should simply filter to nothing.
  const rows = all
    .filter((row) => (stage ? row.stage === stage : true))
    .filter((row) => (fit ? (row.fit ?? "unset") === fit : true))
    .sort(comparator(sort));

  const stages = [...new Set(all.map((row) => row.stage))].sort();
  const link = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams({ view: "database" });
    const merged: Record<string, string | undefined> = { sort, stage, fit, ...next };
    for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
    return `/career/jobs?${params.toString()}`;
  };

  return (
    <div className="grid gap-3" data-slot="job-database">
      {/* Filters. Each is a link, so the current view is always a URL and never hidden state. */}
      <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
        <span className="text-muted-foreground">{t("dbStage")}</span>
        <Chip href={link({ stage: undefined })} active={!stage}>
          {t("dbAllStages")}
        </Chip>
        {stages.map((name) => (
          <Chip key={name} href={link({ stage: name })} active={stage === name}>
            {name}
          </Chip>
        ))}
        <span className="ml-2 text-muted-foreground">{t("dbFit")}</span>
        <Chip href={link({ fit: undefined })} active={!fit}>
          {t("dbAnyFit")}
        </Chip>
        {(["strong_fit", "worth_applying", "long_shot", "not_a_fit"] as const).map((band) => (
          <Chip key={band} href={link({ fit: band })} active={fit === band}>
            {t(`fit_${band}`)}
          </Chip>
        ))}
        <span className="ml-auto text-muted-foreground">
          {t("dbCount", { count: rows.length })}
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={all.length === 0 ? t("dbEmptyTitle") : t("dbNoMatchTitle")}
          hint={all.length === 0 ? t("dbEmptyHint") : t("dbNoMatchHint")}
        />
      ) : (
        <Table className="font-mono text-xs [&_td]:px-2 [&_td]:py-1 [&_td]:align-top">
          <caption className="sr-only">{t("dbCaption")}</caption>
          <thead>
            <tr>
              <Th
                href={link({ sort: "position" })}
                label={t("dbPosition")}
                field="position"
                sort={sort}
              />
              <Th
                href={link({ sort: "company" })}
                label={t("dbCompany")}
                field="company"
                sort={sort}
              />
              <Th href={link({ sort: "stage" })} label={t("dbStage")} field="stage" sort={sort} />
              <Th
                href={link({ sort: "seniority" })}
                label={t("dbSeniority")}
                field="seniority"
                sort={sort}
              />
              <Th
                href={link({ sort: "salary" })}
                label={t("dbSalary")}
                field="salary"
                sort={sort}
              />
              <Th href={link({ sort: "fit" })} label={t("dbFit")} field="fit" sort={sort} />
              <Th
                href={link({ sort: "progress" })}
                label={t("dbProgress")}
                field="progress"
                sort={sort}
              />
              <Th
                href={link({ sort: "nextActionDue" })}
                label={t("dbNextAction")}
                field="nextActionDue"
                sort={sort}
              />
              <Th
                href={link({ sort: "location" })}
                label={t("dbLocation")}
                field="location"
                sort={sort}
              />
              <Th
                href={link({ sort: "applyBy" })}
                label={t("dbApplyBy")}
                field="applyBy"
                sort={sort}
              />
              <Th label={t("dbIds")} field="" href="" sort={sort} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.applicationId} data-slot="job-row">
                <td className="max-w-56">
                  <Link
                    href={`/career/jobs/${row.cardId}`}
                    className="block truncate hover:underline"
                    title={row.position}
                  >
                    {row.position}
                  </Link>
                </td>
                <td className="text-muted-foreground">{row.company ?? t("dbNone")}</td>
                <td>{row.stage}</td>
                <td className="text-muted-foreground">{row.seniority ?? t("dbNone")}</td>
                <td className="whitespace-nowrap tabular-nums">{salary(row, t("dbNotStated"))}</td>
                <td>
                  {row.fit ? (
                    <span className={FIT_CLASS[row.fit]}>{t(`fit_${row.fit}`)}</span>
                  ) : (
                    <span className="text-muted-foreground">{t("dbNone")}</span>
                  )}
                </td>
                <td className="w-28">
                  {row.progress === null ? (
                    <span className="text-muted-foreground">{t("dbNone")}</span>
                  ) : (
                    <AsciiMeter
                      value={row.progress / 100}
                      label={t("dbProgressOf", { count: row.progress })}
                      cells={10}
                      showValue
                      className="text-[10px]"
                    />
                  )}
                </td>
                <td className="max-w-64">
                  <span className="block truncate" title={row.nextAction ?? undefined}>
                    {row.nextAction ?? t("dbNone")}
                  </span>
                  {row.nextActionDue ? (
                    <span className="text-[10px] text-warning">
                      {row.nextActionDue.toISOString().slice(0, 10)}
                    </span>
                  ) : null}
                </td>
                <td className="text-muted-foreground">{row.location ?? t("dbNone")}</td>
                <td className="whitespace-nowrap tabular-nums text-muted-foreground">
                  {row.applyBy ? row.applyBy.toISOString().slice(0, 10) : t("dbNone")}
                </td>
                <td className="whitespace-nowrap text-[10px] text-muted-foreground">
                  {row.appId ? <span>{row.appId} </span> : null}
                  {row.reqId ? <span>{row.reqId}</span> : null}
                  {!row.appId && !row.reqId ? t("dbNone") : null}
                  {row.coverLetterNeeded ? (
                    <span className="ml-1 text-warning">{t("dbClNeeded")}</span>
                  ) : null}
                  {row.url ? (
                    <a
                      href={row.url}
                      rel="noreferrer noopener"
                      target="_blank"
                      className="ml-1 text-primary hover:underline"
                    >
                      ↗
                    </a>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

/** Fit is a judgement, so the band is the headline and the score stays in the tooltip. */
const FIT_CLASS: Record<string, string> = {
  strong_fit: "text-success",
  worth_applying: "text-info",
  long_shot: "text-warning",
  not_a_fit: "text-muted-foreground",
};

/** Salary as a range, a single bound, or an honest blank — never a zero. */
function salary(row: JobRow, fallback: string): string {
  if (row.salaryMin === null && row.salaryMax === null) return fallback;
  const unit = row.currency ? `${row.currency} ` : "";
  if (row.salaryMin !== null && row.salaryMax !== null) {
    return `${unit}${row.salaryMin.toLocaleString("en")}–${row.salaryMax.toLocaleString("en")}`;
  }
  return `${unit}${(row.salaryMin ?? row.salaryMax)?.toLocaleString("en")}`;
}

/** Sort with nulls last in every direction, so an empty cell never masquerades as a value. */
function comparator(sort: string | undefined) {
  return (a: JobRow, b: JobRow) => {
    const dir = sort?.startsWith("-") ? -1 : 1;
    const sortField = (sort ?? "").replace(/^-/, "");
    const value = (row: JobRow): string | number | null => {
      switch (sortField) {
        case "company":
          return row.company;
        case "stage":
          return row.stage;
        case "seniority":
          return row.seniority;
        case "salary":
          return row.salaryMax ?? row.salaryMin;
        case "fit":
          return row.fitScore;
        case "progress":
          return row.progress;
        case "nextActionDue":
          return row.nextActionDue?.getTime() ?? null;
        case "location":
          return row.location;
        case "applyBy":
          return row.applyBy?.getTime() ?? null;
        default:
          return row.position;
      }
    };
    const left = value(a);
    const right = value(b);
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return (left < right ? -1 : left > right ? 1 : 0) * dir;
  };
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={
        active
          ? "rounded-[var(--radius)] bg-primary px-1.5 py-0.5 text-primary-foreground"
          : "rounded-[var(--radius)] border border-border px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
      }
    >
      {children}
    </Link>
  );
}

/** A sortable header. Clicking the active column flips direction; any other column starts ascending. */
function Th({
  href,
  label,
  field,
  sort,
}: {
  href: string;
  label: string;
  field: string;
  sort: string | undefined;
}) {
  if (field === "") {
    return (
      <th className="px-2 py-1 text-left text-[10px] font-normal text-muted-foreground uppercase">
        {label}
      </th>
    );
  }
  const active = sort === field || sort === `-${field}`;
  return (
    <th scope="col" className="px-2 py-1 text-left text-[10px] font-normal uppercase">
      <Link
        href={href}
        aria-sort={active ? (sort?.startsWith("-") ? "descending" : "ascending") : undefined}
        className={active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}
      >
        {label}
        {active ? <span aria-hidden="true">{sort?.startsWith("-") ? " ↓" : " ↑"}</span> : null}
      </Link>
    </th>
  );
}
