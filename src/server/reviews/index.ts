import { desc, eq } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { reviews } from "@/server/db/schema";
import { createNote } from "@/server/notes";
import { dayKey } from "@/server/habits/streak";

/**
 * Review wizard (spec §6.2/§6.4): a guided weekly or monthly review whose output **is a note**
 * (ADR-045) — so it is searchable, backlinkable and editable like anything else, and the wizard
 * needs no storage of its own beyond the row that timestamps it.
 */

export type ReviewRow = typeof reviews.$inferSelect;
export type ReviewPeriod = "weekly" | "monthly";

export interface ReviewAnswers {
  /** What went well — becomes the note's "wins" section. */
  wins: string;
  /** What did not — the note's "lessons" section. */
  lessons: string;
  /** What is planned next — the note's "next" section. */
  next: string;
  /** Wizard steps the user confirmed; recorded so the note shows what was actually done. */
  clearedInbox: boolean;
  reviewedBoards: boolean;
  reviewedGoals: boolean;
}

/** The wizard's output as markdown — deterministic, so a test can assert its shape. */
export function renderReviewNote(
  period: ReviewPeriod,
  day: string,
  answers: ReviewAnswers,
): string {
  const steps = [
    answers.clearedInbox ? "cleared the inbox" : "inbox not cleared",
    answers.reviewedBoards ? "reviewed the boards" : "boards not reviewed",
    answers.reviewedGoals ? "reviewed the goals" : "goals not reviewed",
  ];
  return [
    `# ${period === "weekly" ? "Weekly" : "Monthly"} review — ${day}`,
    "",
    `Steps: ${steps.join(", ")}.`,
    "",
    "## Wins",
    answers.wins.trim() === "" ? "_nothing recorded_" : answers.wins.trim(),
    "",
    "## Lessons",
    answers.lessons.trim() === "" ? "_nothing recorded_" : answers.lessons.trim(),
    "",
    "## Next",
    answers.next.trim() === "" ? "_nothing recorded_" : answers.next.trim(),
    "",
  ].join("\n");
}

export async function listReviews(userId: string, limit = 12): Promise<ReviewRow[]> {
  return db
    .select()
    .from(reviews)
    .where(eq(reviews.user_id, userId))
    .orderBy(desc(reviews.started_at))
    .limit(limit);
}

/** Complete a review: writes the note and the row that points at it, in that order. */
export async function completeReview(
  userId: string,
  input: { period?: ReviewPeriod; answers: ReviewAnswers; day?: string },
): Promise<ReviewRow> {
  const period = input.period ?? "weekly";
  const day = input.day ?? dayKey(new Date());
  const note = await createNote(userId, {
    title: `${period === "weekly" ? "Weekly" : "Monthly"} review — ${day}`,
    body: renderReviewNote(period, day, input.answers),
    kind: "note",
  });

  const [row] = await db
    .insert(reviews)
    .values({
      id: newId(),
      user_id: userId,
      period,
      note_id: note.id,
      started_at: new Date(),
      completed_at: new Date(),
    })
    .returning();
  if (!row) throw new Error("review insert returned no row");
  return row;
}
