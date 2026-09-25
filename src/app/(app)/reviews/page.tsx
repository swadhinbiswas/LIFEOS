import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
import { getServerSession } from "@/server/auth/session";
import { listReviews } from "@/server/reviews";

import { ReviewWizard } from "./_components/review-wizard";

export const metadata = { title: "Reviews" };

/**
 * `/reviews` (spec §6.2/§6.4): the guided weekly/monthly review. Its output is a note (ADR-045),
 * so past reviews are ordinary notes — searchable, backlinkable, linkable from here.
 */
export default async function ReviewsPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Reviews");
  const reviews = await listReviews(session.user.id);

  return (
    <>
      <PageHeader title={t("title")} />

      <div className="grid max-w-3xl gap-4">
        <Panel title={t("start")}>
          <ReviewWizard />
        </Panel>

        <Panel title={t("past")} hint={`${reviews.length}`}>
          {reviews.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {reviews.map((review) => (
                <li
                  key={review.id}
                  data-slot="review-row"
                  className="flex flex-wrap items-center gap-2 border border-border px-2 py-1 font-mono text-xs"
                >
                  <time dateTime={new Date(review.started_at).toISOString()}>
                    {new Date(review.started_at).toISOString().slice(0, 10)}
                  </time>
                  <span className="text-primary">{review.period}</span>
                  {review.note_id ? (
                    <Link
                      href={`/notes/${review.note_id}`}
                      className="text-muted-foreground hover:underline"
                    >
                      {t("openNote")}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
