import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
import { getServerSession } from "@/server/auth/session";
import { getBoard } from "@/server/boards";
import { ensureJobBoard, getJobMeta } from "@/server/career";

import { JobDatabase } from "./_components/job-database";

import { BoardView } from "../../_components/board/board-view";
import { NewJobForm } from "./_components/new-job-form";

import { pageMetadata } from "@/lib/page-metadata";

export async function generateMetadata() {
  return pageMetadata("Pages.Career", "jobsTitle");
}

/**
 * `/career/jobs` (spec §6.3): the job pipeline *is* the board engine (ADR-044), so the page
 * creates the spec's pipeline board on first visit and hands it to the same `BoardView` the
 * task board uses — ordering, versions, filters, saved views, virtualisation and the keyboard
 * layer all come with it. Cards carry company / excitement / source chips and link to the
 * job's own page.
 */
type PageProps = {
  searchParams: Promise<{ view?: string; sort?: string; stage?: string; fit?: string }>;
};

export default async function JobsPage({ searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  // The board stays the default: it answers "what needs moving". `?view=database` answers "what do I
  // have" — every identifying field, sortable, in one table (ADR-126). URL state, so a filtered
  // table is a link (ADR-042).
  const { view, sort, stage, fit } = await searchParams;
  const showDatabase = view === "database";

  const t = await getTranslations("Pages.Career");
  const board = await ensureJobBoard(session.user.id);
  const [payload, meta] = await Promise.all([
    getBoard(session.user.id, board.id),
    getJobMeta(session.user.id),
  ]);

  const cardMeta = Object.fromEntries(
    Object.entries(meta).map(([cardId, chips]) => [
      cardId,
      chips.map((chip) => ({ label: chip.label, href: chip.detailHref })),
    ]),
  );

  return (
    <>
      <PageHeader title={t("jobsTitle")}>
        <div className="flex items-center gap-1 font-mono text-[10px]">
          <ViewTab href="/career/jobs" active={!showDatabase}>
            {t("viewPipeline")}
          </ViewTab>
          <ViewTab href="/career/jobs?view=database" active={showDatabase}>
            {t("viewDatabase")}
          </ViewTab>
        </div>
      </PageHeader>

      <div className="grid min-w-0 gap-4">
        {showDatabase ? (
          <Panel title={t("dbTitle")}>
            <JobDatabase userId={session.user.id} sort={sort} stage={stage} fit={fit} />
          </Panel>
        ) : (
          <>
            <Panel title={t("addJob")}>
              <NewJobForm boardId={board.id} />
            </Panel>
            <BoardView boardId={board.id} initialData={payload} cardMeta={cardMeta} />
          </>
        )}
      </div>
    </>
  );
}

/** A view switch. Links, not buttons: the view belongs in the URL so it can be shared. */
function ViewTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "rounded-[var(--radius)] bg-primary px-1.5 py-0.5 text-primary-foreground"
          : "rounded-[var(--radius)] border border-border px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
      }
    >
      {children}
    </Link>
  );
}
