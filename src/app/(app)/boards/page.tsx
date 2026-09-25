import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
import { getServerSession } from "@/server/auth/session";
import { listBoards } from "@/server/boards";

import { CreateBoardForm } from "./_components/create-board-form";

export const metadata = { title: "Boards" };

/** `/boards` — the user's boards, plus one-click creation from a template (spec §6.1). */
export default async function BoardsPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Boards");
  const boards = await listBoards(session.user.id);

  return (
    <>
      <PageHeader title={t("title")} count={boards.length} />

      <div className="grid min-w-0 gap-4">
        <Panel title={t("newBoard")}>
          <CreateBoardForm />
        </Panel>

        <Panel title={t("yourBoards")} hint={`${boards.length}`}>
          {boards.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {boards.map((board) => (
                <li key={board.id}>
                  <Link
                    href={`/boards/${board.id}`}
                    className="flex items-center gap-2 px-1 py-1 font-mono text-xs hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="min-w-0 flex-1 truncate">{board.name}</span>
                    {board.is_system ? (
                      <span className="text-muted-foreground">{t("tasksLabel")}</span>
                    ) : (
                      <span className="text-muted-foreground">{board.template ?? t("blank")}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
