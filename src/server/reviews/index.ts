import { desc, eq } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { reviews } from "@/server/db/schema";
import { readDaySignalsRange } from "@/server/day";
import { summariseWeek, type WeekInsight } from "@/server/day/insights";
import { createNote } from "@/server/notes";
import { getUserDayKey } from "@/server/settings";

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

/**
 * What each signal is called in a correlation sentence. One constant rather than a value at each
 * call site: the sentence is assembled from these, and two callers passing two different nouns for
 * "sleep" would make two reviews disagree about the same week.
 */
const DAY_SIGNAL_NAMES = {
  sleep: "sleep",
  mood: "mood",
  habit: "habits kept",
  focus: "focus time",
} as const;

/** The wizard's output as markdown — deterministic, so a test can assert its shape. */
export function renderReviewNote(
  period: ReviewPeriod,
  day: string,
  answers: ReviewAnswers,
  /** The week's measured signals, when the caller has them (ADR-132). */
  signals?: ReviewSignalLines,
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
    ...(signals ? ["", "## Signals", ...signals.lines] : []),
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

/**
 * The review's measured week, as markdown lines.
 *
 * **Coverage is printed next to every mean.** A sleep average over three nights is a number about
 * three nights, and "7h" alone would claim a week. The line says "3 of 7 nights" so the reader can
 * weigh it — and when a signal was never recorded the line says so rather than omitting it, because
 * "you did not log your mood" is itself the most actionable thing in a review.
 *
 * A correlation is only emitted when there were enough overlapping days to mean anything
 * ({@link MIN_DAYS} in the insights module). Three points always fit a line, and advice from three
 * points is worse than no advice.
 */
export interface ReviewSignalLines {
  lines: string[];
}

export function renderSignalLines(week: WeekInsight, windowDays: number): ReviewSignalLines {
  const lines: string[] = [];
  const coverage = (recorded: number): string => `${recorded} of ${windowDays}`;

  lines.push(
    week.coverage.sleep > 0
      ? `- Sleep: ${week.sleep === null ? "—" : `${round1(week.sleep)}h`} (${coverage(week.coverage.sleep)} days).`
      : "- Sleep: not recorded.",
  );
  lines.push(
    week.coverage.mood > 0
      ? `- Mood: ${week.mood === null ? "—" : round1(week.mood)} of 5 (${coverage(week.coverage.mood)} days).`
      : "- Mood: not recorded.",
  );
  lines.push(
    week.coverage.habits > 0
      ? `- Habits kept: ${Math.round(week.habitPct)}% (${coverage(week.coverage.habits)} days).`
      : "- Habits kept: none recorded.",
  );
  lines.push(`- Focus: ${Math.round(week.focusMinutes)} min over ${week.coverage.focus} days.`);
  if (week.headline) lines.push("", week.headline);
  return { lines };
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

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
  const day = input.day ?? (await getUserDayKey(userId));
  // The signals are read here, next to the note they go into, rather than by the caller: the wizard
  // is a client component and would otherwise have to fetch a week of four domains to pass strings
  // back for a server function to re-read anyway.
  const windowDays = period === "weekly" ? 7 : 30;
  const week = summariseWeek(await readDaySignalsRange(userId, windowDays), DAY_SIGNAL_NAMES);
  const note = await createNote(userId, {
    title: `${period === "weekly" ? "Weekly" : "Monthly"} review — ${day}`,
    body: renderReviewNote(period, day, input.answers, renderSignalLines(week, windowDays)),
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
