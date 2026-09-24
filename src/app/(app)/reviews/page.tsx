import Link from "next/link";
import { redirect } from "next/navigation";

import { Panel } from "@/components/tui/panel";
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

  const reviews = await listReviews(session.user.id);

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">Reviews</h1>

      <div className="grid max-w-3xl gap-4">
        <Panel title="Start a review">
          <ReviewWizard />
        </Panel>

        <Panel title="Past reviews" hint={`${reviews.length}`}>
          {reviews.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">
              no reviews yet — one a week keeps the numbers honest
            </p>
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
                      open note →
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
