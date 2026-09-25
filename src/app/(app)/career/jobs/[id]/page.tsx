import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { getServerSession } from "@/server/auth/session";
import { getJobDetail } from "@/server/career";

import { AddInterviewForm, AddOfferForm } from "../_components/job-detail-forms";

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
 * `/career/jobs/[id]` (spec §6.3): the application's own page. `[id]` is the **card id** so the
 * board can link straight to it. Interview rounds and offers are recorded here.
 */
export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Career");
  const { id } = await params;
  const detail = await getJobDetail(session.user.id, id).catch(() => null);
  if (!detail) notFound();

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
          </dl>
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
