import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
import { getServerSession } from "@/server/auth/session";
import { listFollowUps } from "@/server/career";
import { getTimeZone } from "@/server/settings";

import { pageMetadata } from "@/lib/page-metadata";
import Link from "next/link";

export async function generateMetadata() {
  return pageMetadata("Pages.Career", "followUpsTitle");
}

/**
 * `/career/follow-ups` (ADR-114).
 *
 * The reference tracker keeps interviews and follow-ups in a database of their own, and that is the
 * shape worth copying: a follow-up has a **due date and no start time**, so a calendar built on
 * `starts_at` cannot show it, and an application tracker that only lists stages cannot either. This
 * page is the one screen that answers "what do I owe, and what is late".
 *
 * Server-rendered, like every other list here. Overdue is carried by a word and a rule, never by
 * colour alone (spec §4.4).
 */
export default async function FollowUpsPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Career");
  const now = new Date();
  const [rows, timeZone] = await Promise.all([
    listFollowUps(session.user.id, now),
    getTimeZone(session.user.id),
  ]);

  const day = (at: Date): string =>
    new Intl.DateTimeFormat(undefined, { timeZone, dateStyle: "medium" }).format(at);
  const overdue = rows.filter((row) => row.overdue);
  const upcoming = rows.filter((row) => !row.overdue);

  const row = (item: (typeof rows)[number]) => (
    <li
      key={`${item.interviewId ?? "next"}-${item.applicationId}`}
      data-slot="follow-up"
      data-overdue={item.overdue}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border py-1.5"
    >
      {/* The date, and the word. Overdue is never colour alone. */}
      <span
        className={
          item.overdue
            ? "w-32 shrink-0 border-l-2 border-destructive pl-1 font-mono text-[10px] text-destructive"
            : "w-32 shrink-0 border-l-2 border-border pl-1 font-mono text-[10px] text-muted-foreground"
        }
      >
        {item.dueAt ? day(item.dueAt) : "—"}
        {item.overdue ? <span className="ml-1 uppercase">{t("overdue")}</span> : null}
      </span>
      <span className="min-w-0 flex-1">
        <Link
          href={`/career/jobs/${item.cardId}`}
          className="font-mono text-xs text-foreground hover:underline"
        >
          {item.position}
        </Link>
        {item.company ? (
          <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{item.company}</span>
        ) : null}
      </span>
      <span className="font-mono text-[10px] text-muted-foreground">
        {item.kind === "next_action" ? t("kindNextAction") : item.kind}
      </span>
      {item.nextAction ? (
        <span className="w-full font-mono text-[10px] text-muted-foreground sm:w-auto">
          {item.nextAction}
        </span>
      ) : null}
    </li>
  );

  return (
    <>
      <PageHeader title={t("followUpsTitle")} count={rows.length} />

      <div className="grid max-w-4xl gap-4">
        {rows.length === 0 ? (
          <Panel title={t("followUpsTitle")}>
            <p className="font-mono text-xs text-muted-foreground">{t("noFollowUps")}</p>
            <Link
              href="/career/jobs"
              className="font-mono text-[10px] text-primary hover:underline"
            >
              {t("backToPipeline")}
            </Link>
          </Panel>
        ) : (
          <>
            {/* Late first, and separated, because a mixed list buries the two rows that matter. */}
            <Panel title={t("overdueTitle")} hint={`${overdue.length}`}>
              {overdue.length === 0 ? (
                <p className="font-mono text-xs text-muted-foreground">{t("nothingOverdue")}</p>
              ) : (
                <ul className="flex flex-col">{overdue.map(row)}</ul>
              )}
            </Panel>
            <Panel title={t("upcomingTitle")} hint={`${upcoming.length}`}>
              <ul className="flex flex-col">{upcoming.map(row)}</ul>
            </Panel>
          </>
        )}
      </div>
    </>
  );
}
