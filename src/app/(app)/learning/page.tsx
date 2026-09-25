import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
import { Progress } from "@/components/ui/progress";
import { getServerSession } from "@/server/auth/session";
import { listBooks, listCourses } from "@/server/learning";

import {
  AddBookForm,
  AddCourseForm,
  BookStatus,
  CourseProgress,
} from "./_components/learning-controls";

export const metadata = { title: "Learning" };

/**
 * `/learning` (spec §6.6): courses with a learner-set progress and deadlines, and books with a
 * reading status. Nothing is inferred from activity — progress is what the learner says it is.
 */
export default async function LearningPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Learning");
  const [courses, books] = await Promise.all([
    listCourses(session.user.id),
    listBooks(session.user.id),
  ]);

  return (
    <>
      <PageHeader title={t("title")} />

      <div className="grid max-w-3xl gap-4">
        <Panel title={t("courses")} hint={`${courses.length}`}>
          <AddCourseForm />
          {courses.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">{t("noCourses")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {courses.map((course) => (
                <li
                  key={course.id}
                  data-slot="course-row"
                  className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-border px-2 py-1.5 font-mono text-xs transition-colors hover:border-ring"
                >
                  <span className="min-w-0 flex-1 truncate">{course.title}</span>
                  {course.provider ? (
                    <span className="text-muted-foreground">{course.provider}</span>
                  ) : null}
                  <Progress
                    value={course.progress}
                    aria-label={course.title}
                    className="h-1.5 w-24"
                  />
                  <CourseProgress courseId={course.id} progress={course.progress} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t("books")} hint={`${books.length}`}>
          <AddBookForm />
          {books.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">{t("noBooks")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {books.map((book) => (
                <li
                  key={book.id}
                  data-slot="book-row"
                  className="flex flex-wrap items-center gap-2 border border-border px-2 py-1 font-mono text-xs"
                >
                  <span className="min-w-0 flex-1 truncate">{book.title}</span>
                  {book.author ? (
                    <span className="text-muted-foreground">{book.author}</span>
                  ) : null}
                  {book.finished_at ? (
                    <time
                      dateTime={new Date(book.finished_at).toISOString()}
                      className="text-success"
                    >
                      {new Date(book.finished_at).toISOString().slice(0, 10)}
                    </time>
                  ) : null}
                  <BookStatus bookId={book.id} status={book.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
