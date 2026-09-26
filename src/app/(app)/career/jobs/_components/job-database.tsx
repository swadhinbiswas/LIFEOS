import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Table } from "@/components/ui/table";
import { EmptyState } from "@/components/tui/empty-state";
import { chipState } from "@/components/tui/controls";
import { listJobApplications, listJobStages, type JobRow } from "@/server/career/applications";
import {
  InlineCoverLetter,
  InlineEnum,
  InlineFit,
  InlineProgress,
  InlineStage,
  InlineText,
} from "./inline-cells";

/**
 * The applications database (ADR-126): every field, one row each, sortable, filterable **and
 * editable in place** (ADR-127).
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
  boardId,
  sort,
  stage,
  fit,
}: {
  userId: string;
  /** The job pipeline's board. Its columns are the stages; another board's are not. */
  boardId: string;
  sort: string | undefined;
  stage: string | undefined;
  fit: string | undefined;
}) {
  const t = await getTranslations("Pages.Career");
  const [all, boardStages] = await Promise.all([
    listJobApplications(userId),
    listJobStages(userId, boardId),
  ]);

  // Filtering here rather than in SQL keeps the column list readable and the stage list honest: the
  // stages are board columns, and a stage that no longer exists should simply filter to nothing.
  const rows = all
    .filter((row) => (stage ? row.stage === stage : true))
    .filter((row) => (fit ? (row.fit ?? "unset") === fit : true))
    .sort(comparator(sort));

  // The filter chips are the stages that *have* rows — a chip that filters to nothing is noise. The
  // dropdown needs the opposite: every column on the board, including "Offer" on the day nothing is
  // there, or a row could only ever be moved to a stage something else already occupies.
  const stagesPresent = [...new Set(all.map((row) => row.stage))].sort();
  const stageNames = boardStages.map((column) => column.name);
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
        {stagesPresent.map((name) => (
          <Chip key={name} href={link({ stage: name })} active={stage === name}>
            {name}
          </Chip>
        ))}
        <span className="ml-2 text-muted-foreground">{t("dbFit")}</span>
        <Chip href={link({ fit: undefined })} active={!fit}>
          {t("dbAnyFit")}
        </Chip>
        {FIT_BANDS.map((band) => (
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
        <Table
          containerClassName="scroll-shadow-x"
          className="font-mono text-xs [&_td]:px-2 [&_td]:py-1 [&_td]:align-top"
        >
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
                <td className="max-w-48 min-w-44">
                  <Link
                    href={`/career/jobs/${row.cardId}`}
                    className="flex min-h-6 items-center truncate hover:underline"
                    title={row.position}
                  >
                    {row.position}
                  </Link>
                </td>
                <td className="min-w-32">
                  <InlineText
                    applicationId={row.applicationId}
                    field="companyName"
                    value={row.company}
                    label={t("dbCompany")}
                    placeholder={t("dbNone")}
                  />
                </td>
                <td className="min-w-32">
                  <InlineStage
                    applicationId={row.applicationId}
                    value={row.stage}
                    stages={stageNames}
                  />
                </td>
                <td className="min-w-28">
                  <InlineEnum
                    applicationId={row.applicationId}
                    field="seniority"
                    value={row.seniority}
                    label={t("dbSeniority")}
                    options={[
                      ["junior", t("seniority_junior")],
                      ["mid", t("seniority_mid")],
                      ["senior", t("seniority_senior")],
                      ["not_stated", t("seniority_not_stated")],
                    ]}
                  />
                </td>
                <td className="whitespace-nowrap tabular-nums">{salary(row, t("dbNotStated"))}</td>
                <td className="min-w-24">
                  <span className="grid gap-0.5">
                    <InlineFit applicationId={row.applicationId} value={row.fitScore} />
                    {row.fit ? (
                      <span className={`text-[10px] ${FIT_CLASS[row.fit]}`}>
                        {t(`fit_${row.fit}`)}
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="min-w-32">
                  <InlineProgress applicationId={row.applicationId} value={row.progress} />
                </td>
                <td className="min-w-48">
                  <InlineText
                    applicationId={row.applicationId}
                    field="nextAction"
                    value={row.nextAction}
                    label={t("dbNextAction")}
                    placeholder={t("dbNone")}
                  />
                  {row.nextActionDue ? (
                    <span className="block text-[10px] text-warning">
                      {row.nextActionDue.toISOString().slice(0, 10)}
                    </span>
                  ) : null}
                </td>
                <td className="min-w-32">
                  <InlineText
                    applicationId={row.applicationId}
                    field="location"
                    value={row.location}
                    label={t("dbLocation")}
                    placeholder={t("dbNone")}
                  />
                </td>
                <td className="whitespace-nowrap tabular-nums text-muted-foreground">
                  {row.applyBy ? row.applyBy.toISOString().slice(0, 10) : t("dbNone")}
                </td>
                <td className="min-w-28 whitespace-nowrap text-[10px] text-muted-foreground">
                  <span className="grid gap-0.5">
                    <InlineText
                      applicationId={row.applicationId}
                      field="appId"
                      value={row.appId}
                      label={t("dbAppId")}
                      placeholder={t("dbNone")}
                    />
                    {row.reqId ? <span>{row.reqId}</span> : null}
                    <InlineCoverLetter
                      applicationId={row.applicationId}
                      value={row.coverLetterNeeded}
                    />
                    {row.url ? (
                      <a
                        href={row.url}
                        rel="noreferrer noopener"
                        target="_blank"
                        className="text-primary hover:underline"
                      >
                        ↗ {t("dbPosting")}
                      </a>
                    ) : null}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

/** The bands `fitBandFor` can return, in the order that reads as descending fit. */
const FIT_BANDS = ["strong_fit", "worth_applying", "long_shot", "not_a_fit"] as const;

/** Fit is a judgement, so the band is the headline and the score stays in the input beside it. */
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

/**
 * A filter chip.
 *
 * `chipState` rather than a class string written here. The first version of this file declared its
 * own `px-1.5 py-0.5 text-[10px]` chip and re-implemented the active/inactive colours, which is two
 * kinds of wrong at once: it bypassed the shared vocabulary (ADR-118) *and* it came out 19px tall,
 * under the 24px floor, because the one thing the shared class carries is `min-h-6`. Ten chips at
 * 19px is ten targets the size guard would reject.
 */
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
    <Link href={href} aria-current={active ? "true" : undefined} className={chipState(active)}>
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
  /** Empty means "not a sort column" — the ids column, which is a bag of values, not an ordering. */
  field: string;
  sort: string | undefined;
}) {
  if (field === "") {
    return (
      <th
        scope="col"
        className="px-2 py-1 text-left text-[10px] font-normal text-muted-foreground uppercase"
      >
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
