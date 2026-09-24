import { redirect } from "next/navigation";

import { Panel } from "@/components/tui/panel";
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

  const { items } = await listTrash(session.user.id);

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">Trash</h1>

      <div className="grid max-w-3xl gap-4">
        <Panel title="Deleted" hint={`${items.length}`}>
          {items.length === 0 ? (
            <p data-slot="trash-empty" className="font-mono text-xs text-muted-foreground">
              nothing in the trash — deleted cards and notes stay here for 30 days, then they are
              gone
            </p>
          ) : (
            <TrashList items={items} />
          )}
        </Panel>
      </div>
    </>
  );
}
