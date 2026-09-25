import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/tui/page-header";
import { Panel } from "@/components/tui/panel";
import { getServerSession } from "@/server/auth/session";
import { atsReview, getResume, listVersions } from "@/server/cv";
import { toMarkdown } from "@/server/cv/export";

import { CvEditor } from "./_components/cv-editor";

export const metadata = { title: "CV" };

/**
 * `/career/cv/[id]` (spec §6.3): the editor, a live text preview, the derived checklist, versions,
 * sharing and exports. The preview is the same Markdown the export produces, so what you read is
 * what you download.
 */
export default async function CvEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const { id } = await params;
  const detail = await getResume(session.user.id, id);
  if (!detail) notFound();

  const t = await getTranslations("Pages.Cv");
  const [versions, review] = await Promise.all([
    listVersions(session.user.id, id),
    Promise.resolve(atsReview(detail.document)),
  ]);

  return (
    <>
      <PageHeader title={detail.summary.title}>
        <Link href="/career/cv" className="font-mono text-xs text-muted-foreground hover:underline">
          {t("backToLibrary")}
        </Link>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title={t("editor")}>
          <CvEditor
            resumeId={id}
            title={detail.summary.title}
            document={detail.document}
            checks={review.checks}
            score={review.score}
            shareEnabled={detail.summary.shareEnabled}
            shareSlug={detail.summary.shareSlug}
            versions={versions.map((version) => ({
              id: version.id,
              label: version.label,
              createdAt: version.createdAt.toISOString(),
            }))}
          />
        </Panel>

        <Panel title={t("preview")}>
          <pre
            data-slot="cv-preview"
            className="max-h-[70vh] overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed"
          >
            {toMarkdown(detail.document)}
          </pre>
        </Panel>
      </div>
    </>
  );
}
