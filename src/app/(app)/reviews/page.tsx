import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
import { AsciiMeter } from "@/components/tui/ascii-meter";
import { getServerSession } from "@/server/auth/session";
import { listReviews } from "@/server/reviews";
import { reviewStreak } from "@/server/reviews/streak";
import { reviewDraftAvailable } from "@/server/reviews/draft";
import { getRegionalSettings } from "@/server/settings";

import { ReviewWizard } from "./_components/review-wizard";

import { pageMetadata } from "@/lib/page-metadata";

export async function generateMetadata() {
  return pageMetadata("Pages.Reviews", "title");
}

/**
 * `/reviews` (spec §6.2/§6.4, ADR-116): the guided weekly/monthly review. Its output is a note
 * (ADR-045), so past reviews are ordinary notes — searchable, backlinkable, linkable from here.
 *
 * The streak is the reason to come back, so it sits above the wizard rather than below it: a
 * "weekly review" whose whole point is the weekly habit should not make you scroll to find out
 * whether you kept it.
 */
export default async function ReviewsPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Reviews");
  const now = new Date();
  const [reviews, regional, canDraft] = await Promise.all([
    listReviews(session.user.id),
    getRegionalSettings(session.user.id),
    reviewDraftAvailable(session.user.id),
  ]);

  const streak = reviewStreak(reviews, now, regional.timeZone, regional.weekStart);
  // 52 rows is a year of weeks, which is the longest streak the counter can actually reach.
  const cadence = reviews[0]?.period === "monthly" ? t("monthly") : t("weekly");
  const perYear = cadence === t("monthly") ? 12 : 52;

  return (
    <>
      <PageHeader title={t("title")} />

      <div className="grid max-w-4xl gap-4">
        {/* The habit, in one line: how long, and how much of the year is covered. */}
        <Panel title={t("streakTitle")} hint={`${streak} ${t("weekStreakShort")}`}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <p className="flex items-baseline gap-2">
              <span className="font-mono text-2xl leading-none font-semibold tabular-nums">
                {streak}
              </span>
              <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                {t("weekStreakShort")}
              </span>
            </p>
            <AsciiMeter
              // A streak meter against the longest a year can reach, so the bar means something
              // rather than always sitting near the end.
              value={Math.min(1, streak / perYear)}
              label={t("streakMeter", { count: streak })}
              className="text-[11px]"
            />
            <p className="font-mono text-[10px] text-muted-foreground">{t("streakHint")}</p>
          </div>
        </Panel>

        <Panel title={t("start")}>
          <ReviewWizard canDraft={canDraft} />
        </Panel>

        <Panel title={t("past")} hint={`${reviews.length}`}>
          {reviews.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="grid gap-1.5">
              {reviews.map((review) => {
                const at = new Date(review.started_at);
                return (
                  <li
                    key={review.id}
                    data-slot="review-row"
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-border py-0.5 pl-2"
                  >
                    <time
                      dateTime={at.toISOString()}
                      className="font-mono text-[10px] tabular-nums text-muted-foreground"
                    >
                      {at.toISOString().slice(0, 10)}
                    </time>
                    <span className="font-mono text-[10px] tracking-wider text-primary uppercase">
                      {review.period}
                    </span>
                    {review.note_id ? (
                      <Link
                        href={`/notes/${review.note_id}`}
                        className="font-mono text-xs text-foreground hover:underline"
                      >
                        {t("openNote")}
                      </Link>
                    ) : (
                      // A review whose note is gone is still a row that happened; saying so beats
                      // rendering an empty link.
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {t("noNote")}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
