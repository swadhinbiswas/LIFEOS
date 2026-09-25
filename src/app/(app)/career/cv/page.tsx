import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/tui/empty-state";
import { PageHeader } from "@/components/tui/page-header";
import { Panel } from "@/components/tui/panel";
import { Badge } from "@/components/ui/badge";
import { getServerSession } from "@/server/auth/session";
import { listResumes } from "@/server/cv";

import { CvNew } from "./_components/cv-new";

export const metadata = { title: "CV" };

/**
 * `/career/cv` (spec §6.3): the CV library. Each row links to the editor and offers its exports
 * directly, so a PDF is two clicks away. The account's own data seeds a first CV — nothing invented.
 */
export default async function CvPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Cv");
  const resumes = await listResumes(session.user.id);

  return (
    <>
      <PageHeader title={t("title")} count={resumes.length}>
        <CvNew />
      </PageHeader>

      <div className="grid gap-4">
        <Panel title={t("library")} hint={`${resumes.length}`}>
          {resumes.length === 0 ? (
            <EmptyState title={t("empty")} hint={t("emptyHint")} />
          ) : (
            <ul className="flex flex-col gap-2">
              {resumes.map((resume) => (
                <li
                  key={resume.id}
                  data-slot="cv-row"
                  className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-border px-2 py-1.5 font-mono text-xs transition-colors hover:border-ring"
                >
                  <Link href={`/career/cv/${resume.id}`} className="text-primary hover:underline">
                    {resume.title}
                  </Link>
                  {resume.atsScore !== null ? (
                    <Badge variant="outline" className="font-mono text-[10px] tabular-nums">
                      {t("checklist", { score: resume.atsScore })}
                    </Badge>
                  ) : null}
                  {resume.shareEnabled && resume.shareSlug ? (
                    <Badge variant="outline" className="font-mono text-[10px] text-warning">
                      {t("shared")}
                    </Badge>
                  ) : null}
                  <span className="text-muted-foreground tabular-nums">
                    {resume.updatedAt.toISOString().slice(0, 10)}
                  </span>
                  <span className="ml-auto flex flex-wrap items-center gap-2 text-[10px]">
                    <a
                      href={`/api/career/cv/${resume.id}/export?format=json`}
                      className="text-muted-foreground hover:underline"
                    >
                      json
                    </a>
                    <a
                      href={`/api/career/cv/${resume.id}/export?format=md`}
                      className="text-muted-foreground hover:underline"
                    >
                      markdown
                    </a>
                    <a
                      href={`/api/career/cv/${resume.id}/export?format=docx`}
                      className="text-muted-foreground hover:underline"
                    >
                      docx
                    </a>
                    <a
                      href={`/career/cv/${resume.id}/print`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      {t("printPdf")}
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
