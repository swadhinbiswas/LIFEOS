import { desc, eq } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { coding_problems, question_bank, star_stories } from "@/server/db/schema";

/**
 * Interview prep (spec §6.3): the question bank, STAR stories and a coding-problem list. Kept
 * separate from the pipeline service because nothing here touches cards or the board engine.
 */

export type QuestionRow = typeof question_bank.$inferSelect;
export type StoryRow = typeof star_stories.$inferSelect;
export type ProblemRow = typeof coding_problems.$inferSelect;

export interface Prep {
  questions: QuestionRow[];
  stories: StoryRow[];
  problems: ProblemRow[];
}

export async function listPrep(userId: string): Promise<Prep> {
  const [questions, stories, problems] = await Promise.all([
    db
      .select()
      .from(question_bank)
      .where(eq(question_bank.user_id, userId))
      .orderBy(desc(question_bank.created_at)),
    db
      .select()
      .from(star_stories)
      .where(eq(star_stories.user_id, userId))
      .orderBy(desc(star_stories.created_at)),
    db
      .select()
      .from(coding_problems)
      .where(eq(coding_problems.user_id, userId))
      .orderBy(desc(coding_problems.created_at)),
  ]);
  return { questions, stories, problems };
}

export async function addQuestion(
  userId: string,
  input: {
    question: string;
    category?: string | null;
    difficulty?: string | null;
    answer?: string | null;
  },
): Promise<QuestionRow> {
  const [row] = await db
    .insert(question_bank)
    .values({
      id: newId(),
      user_id: userId,
      question: input.question.trim(),
      category: input.category ?? null,
      difficulty: input.difficulty ?? null,
      answer: input.answer ?? null,
    })
    .returning();
  if (!row) throw new Error("question insert returned no row");
  return row;
}

export async function addStory(
  userId: string,
  input: {
    title: string;
    situation?: string | null;
    task?: string | null;
    action?: string | null;
    result?: string | null;
  },
): Promise<StoryRow> {
  const [row] = await db
    .insert(star_stories)
    .values({
      id: newId(),
      user_id: userId,
      title: input.title.trim(),
      situation: input.situation ?? null,
      task: input.task ?? null,
      action: input.action ?? null,
      result: input.result ?? null,
    })
    .returning();
  if (!row) throw new Error("story insert returned no row");
  return row;
}

export async function addProblem(
  userId: string,
  input: {
    title: string;
    platform?: string | null;
    url?: string | null;
    difficulty?: string | null;
  },
): Promise<ProblemRow> {
  const [row] = await db
    .insert(coding_problems)
    .values({
      id: newId(),
      user_id: userId,
      title: input.title.trim(),
      platform: input.platform ?? null,
      url: input.url ?? null,
      difficulty: input.difficulty ?? null,
    })
    .returning();
  if (!row) throw new Error("problem insert returned no row");
  return row;
}
