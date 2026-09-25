import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
import { getServerSession } from "@/server/auth/session";
import { listTrash } from "@/server/trash";

import { TrashList } from "./_components/trash-list";

export const metadata = { title: "Trash" };

/**
 * `/trash` (spec §6.9, ADR-048): the cross-module route back for deleted cards and notes. The
 * read purges anything past the 30-day window, so what is shown is always recoverable.
 */
export default async function TrashPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Trash");
  const { items } = await listTrash(session.user.id);

  return (
    <>
      <PageHeader title={t("title")} />

      <div className="grid max-w-3xl gap-4">
        <Panel title={t("deleted")} hint={`${items.length}`}>
          {items.length === 0 ? (
            <p data-slot="trash-empty" className="font-mono text-xs text-muted-foreground">
              {t("empty")}
            </p>
          ) : (
            <TrashList items={items} />
          )}
        </Panel>
      </div>
    </>
  );
}
