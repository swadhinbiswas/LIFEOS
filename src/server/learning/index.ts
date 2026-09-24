import { desc, eq, and } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { books, courses } from "@/server/db/schema";

/**
 * Learning-lite (spec §6.6): courses with progress and deadlines, books with a reading status,
 * notes and highlights. Both are the user's own records — nothing is imported or invented.
 */

export type CourseRow = typeof courses.$inferSelect;
export type BookRow = typeof books.$inferSelect;

export const BOOK_STATUSES = ["want", "reading", "finished", "abandoned"] as const;
export type BookStatus = (typeof BOOK_STATUSES)[number];

export async function listCourses(userId: string): Promise<CourseRow[]> {
  return db
    .select()
    .from(courses)
    .where(eq(courses.user_id, userId))
    .orderBy(desc(courses.updated_at));
}

export async function createCourse(
  userId: string,
  input: { title: string; provider?: string | null; url?: string | null; deadline?: Date | null },
): Promise<CourseRow> {
  const [row] = await db
    .insert(courses)
    .values({
      id: newId(),
      user_id: userId,
      title: input.title.trim(),
      provider: input.provider ?? null,
      url: input.url ?? null,
      deadline: input.deadline ?? null,
    })
    .returning();
  if (!row) throw new Error("course insert returned no row");
  return row;
}

/** Progress is a percentage the learner sets; it is clamped, not inferred. */
export async function setCourseProgress(
  userId: string,
  input: { courseId: string; progress: number },
): Promise<CourseRow> {
  const progress = Math.max(0, Math.min(100, Math.round(input.progress)));
  const [row] = await db
    .update(courses)
    .set({ progress })
    .where(and(eq(courses.id, input.courseId), eq(courses.user_id, userId)))
    .returning();
  if (!row) throw new Error("course not found");
  return row;
}

export async function listBooks(userId: string): Promise<BookRow[]> {
  return db.select().from(books).where(eq(books.user_id, userId)).orderBy(desc(books.updated_at));
}

export async function createBook(
  userId: string,
  input: { title: string; author?: string | null; status?: BookStatus },
): Promise<BookRow> {
  const [row] = await db
    .insert(books)
    .values({
      id: newId(),
      user_id: userId,
      title: input.title.trim(),
      author: input.author ?? null,
      status: input.status ?? "want",
    })
    .returning();
  if (!row) throw new Error("book insert returned no row");
  return row;
}

/** Moving a book to `finished` stamps the date; moving it back clears it. */
export async function setBookStatus(
  userId: string,
  input: { bookId: string; status: BookStatus },
): Promise<BookRow> {
  const [row] = await db
    .update(books)
    .set({
      status: input.status,
      finished_at: input.status === "finished" ? new Date() : null,
    })
    .where(and(eq(books.id, input.bookId), eq(books.user_id, userId)))
    .returning();
  if (!row) throw new Error("book not found");
  return row;
}
