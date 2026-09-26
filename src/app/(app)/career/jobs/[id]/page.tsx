import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { getServerSession } from "@/server/auth/session";
import { getJobDetail } from "@/server/career";
import { getTimeZone } from "@/server/settings";

import { AddInterviewForm, AddOfferForm } from "../_components/job-detail-forms";
import { NextActionForm } from "../_components/next-action-form";

import { pageMetadata } from "@/lib/page-metadata";

export async function generateMetadata() {
  return pageMetadata("Pages.Career", "application");
}

/** Money is stored in minor units (ADR-044); render it back in the job's own currency. */
const money = (minor: number | null, currency: string | null): string => {
  if (minor === null) return "—";
  const amount = (minor / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return currency ? `${amount} ${currency}` : amount;
};

/**
 * A deadline as a day, in the **user's** zone (ADR-057). A `YYYY-MM-DD` date picked on a calendar is
 * stored at UTC midnight, so rendering it in the server's own zone shows the previous day for
 * anyone east of Greenwich — and an apply-by deadline a day early is the kind of bug that costs an
 * application.
 */
const day = (at: Date, timeZone: string): string =>
  new Intl.DateTimeFormat(undefined, { timeZone, dateStyle: "medium" }).format(at);

/** The `YYYY-MM-DD` an `<input type="date">` expects, read in the user's zone (ADR-057). */
const toDateInput = (at: Date | null, timeZone = "UTC"): string =>
  at === null ? "" : new Intl.DateTimeFormat("en-CA", { timeZone, dateStyle: "short" }).format(at);

/**
 * `/career/jobs/[id]` (spec §6.3): the application's own page. `[id]` is the **card id** so the
 * board can link straight to it. Interview rounds and offers are recorded here.
 */
export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Career");
  const { id } = await params;
  // The zone comes first: every date below is rendered in it (ADR-057).
  const [detail, timeZone] = await Promise.all([
    getJobDetail(session.user.id, id).catch(() => null),
    getTimeZone(session.user.id),
  ]);
  if (!detail) notFound();

  // Resolved once: `Date.now()` during render is an impure read, and a page that re-renders would
  // otherwise be able to disagree with itself about whether a date has passed.
  const now = new Date();

  const { card, application, company, interviews, offers } = detail;
  const stage = application.stage_history
    ? (JSON.parse(application.stage_history) as Array<{ to: string }>).at(-1)?.to
    : undefined;

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">
        {card.title}
      </h1>

      <div className="grid max-w-4xl gap-4">
        <Panel title={t("application")} hint={stage ?? undefined}>
          <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <div>
              <dt className="font-mono text-[10px] text-muted-foreground uppercase">
                {t("companyLabel")}
              </dt>
              <dd className="font-mono">{company?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] text-muted-foreground uppercase">
                {t("sourceLabel")}
              </dt>
              <dd className="font-mono">{application.source ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] text-muted-foreground uppercase">
                {t("workMode")}
              </dt>
              <dd className="font-mono">{application.work_mode ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] text-muted-foreground uppercase">{t("visa")}</dt>
              <dd className="font-mono">{application.visa_status ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] text-muted-foreground uppercase">
                {t("salary")}
              </dt>
              <dd className="font-mono tabular-nums">
                {money(application.salary_min, application.currency)} –{" "}
                {money(application.salary_max, application.currency)}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] text-muted-foreground uppercase">
                {t("excitement")}
              </dt>
              <dd className="font-mono">
                {application.excitement === null ? "—" : "★".repeat(application.excitement)}
              </dd>
            </div>
            {/* The deadline fields the reference tracker made obvious (ADR-114). */}
            <div>
              <dt className="font-mono text-[10px] text-muted-foreground uppercase">
                {t("applyBy")}
              </dt>
              <dd className="font-mono">
                {application.apply_by ? day(application.apply_by, timeZone) : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] text-muted-foreground uppercase">
                {t("dateApplied")}
              </dt>
              <dd className="font-mono">
                {application.date_applied ? day(application.date_applied, timeZone) : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] text-muted-foreground uppercase">
                {t("seniority")}
              </dt>
              <dd className="font-mono">{application.seniority ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] text-muted-foreground uppercase">
                {t("reqId")}
              </dt>
              <dd className="font-mono">{application.req_id ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] text-muted-foreground uppercase">
                {t("location")}
              </dt>
              <dd className="font-mono">{application.location ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] text-muted-foreground uppercase">
                {t("applyEmail")}
              </dt>
              <dd className="font-mono">
                {application.apply_email ? (
                  <a
                    href={`mailto:${application.apply_email}`}
                    className="text-primary hover:underline"
                  >
                    {application.apply_email}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>

          {/* The promise. Given its own box because it is the field a tracker exists to hold, and
              it stayed free text in the reference for a reason: the next step is not one of a fixed
              set of values. */}
          <div className="mt-3 rounded-[var(--radius)] border border-border p-2">
            <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
              {t("nextAction")}
            </p>
            <p className="font-mono text-xs">{application.next_action ?? t("noNextAction")}</p>
            {application.next_action_due ? (
              <p
                className={
                  application.next_action_due.getTime() < now.getTime()
                    ? "font-mono text-[10px] text-destructive"
                    : "font-mono text-[10px] text-muted-foreground"
                }
              >
                {t("dueOn", { date: day(application.next_action_due, timeZone) })}
              </p>
            ) : null}
            <NextActionForm
              applicationId={application.id}
              initialAction={application.next_action ?? ""}
              initialDue={toDateInput(application.next_action_due, timeZone)}
            />
          </div>
          {application.url ? (
            <a
              href={application.url}
              className="font-mono text-xs text-primary hover:underline"
              rel="noreferrer noopener"
              target="_blank"
            >
              {t("posting")}
            </a>
          ) : null}
          <Link
            href="/career/jobs"
            className="font-mono text-xs text-muted-foreground hover:underline"
          >
            {t("backToPipeline")}
          </Link>
        </Panel>

        <Panel title={t("interviewLog")} hint={`${interviews.length}`}>
          {interviews.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">{t("noRounds")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {interviews.map((interview) => (
                <li
                  key={interview.id}
                  data-slot="interview-row"
                  className="flex flex-wrap items-center gap-2 border border-border px-2 py-1 font-mono text-xs"
                >
                  <span className="text-primary">{interview.kind}</span>
                  <time
                    dateTime={
                      interview.starts_at ? new Date(interview.starts_at).toISOString() : undefined
                    }
                  >
                    {interview.starts_at
                      ? new Date(interview.starts_at).toISOString().slice(0, 10)
                      : t("noDate")}
                  </time>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {interview.feedback ?? ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <AddInterviewForm applicationId={application.id} />
        </Panel>

        <Panel title={t("offers")} hint={`${offers.length}`}>
          {offers.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">{t("noOffers")}</p>
          ) : (
            <table className="w-full border-collapse font-mono text-xs">
              <thead>
                <tr>
                  <th scope="col" className="border-b border-border px-2 py-1 text-left">
                    {t("base")}
                  </th>
                  <th scope="col" className="border-b border-border px-2 py-1 text-left">
                    {t("bonus")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer) => (
                  <tr key={offer.id} data-slot="offer-row">
                    <td className="border-b border-border px-2 py-1 tabular-nums">
                      {money(offer.base, offer.currency)}
                    </td>
                    <td className="border-b border-border px-2 py-1 tabular-nums">
                      {money(offer.bonus, offer.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <AddOfferForm applicationId={application.id} />
        </Panel>
      </div>
    </>
  );
}
