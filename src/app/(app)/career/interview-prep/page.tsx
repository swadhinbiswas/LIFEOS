import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { getServerSession } from "@/server/auth/session";
import { listPrep } from "@/server/career/prep";

import { AddQuestionForm, AddStoryForm } from "./_components/prep-forms";

export const metadata = { title: "Interview prep" };

/**
 * `/career/interview-prep` (spec §6.3): the question bank and STAR stories. Both are the user's
 * own notes — nothing is seeded here, and no generated answer is presented as theirs.
 */
export default async function InterviewPrepPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Career");
  const prep = await listPrep(session.user.id);

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">
        {t("prepTitle")}
      </h1>

      <div className="grid max-w-4xl gap-4">
        <Panel title={t("questionBank")} hint={`${prep.questions.length}`}>
          <AddQuestionForm />
          {prep.questions.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">{t("noQuestions")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {prep.questions.map((question) => (
                <li
                  key={question.id}
                  data-slot="question-row"
                  className="flex flex-wrap items-center gap-2 border border-border px-2 py-1 font-mono text-xs"
                >
                  <span className="min-w-0 flex-1">{question.question}</span>
                  {question.category ? (
                    <span className="text-primary">{question.category}</span>
                  ) : null}
                  {question.difficulty ? (
                    <span className="text-muted-foreground">{question.difficulty}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t("starStories")} hint={`${prep.stories.length}`}>
          <AddStoryForm />
          {prep.stories.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">{t("noStories")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {prep.stories.map((story) => (
                <li
                  key={story.id}
                  data-slot="story-row"
                  className="flex flex-wrap items-center gap-2 border border-border px-2 py-1 font-mono text-xs"
                >
                  <span className="text-primary">{story.title}</span>
                  {story.result ? (
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {story.result}
                    </span>
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
