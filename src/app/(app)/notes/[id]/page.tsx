import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Panel } from "@/components/tui/panel";
import { getServerSession } from "@/server/auth/session";
import { getNote } from "@/server/notes";

import { NoteEditor } from "./_components/note-editor";

export const metadata = { title: "Note" };

/** `/notes/[id]`: the editor plus the backlink panel (edges the service rebuilds on save). */
export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const { id } = await params;
  const detail = await getNote(session.user.id, id).catch(() => null);
  if (!detail) notFound();

  const { note, backlinks } = detail;

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">
        {note.kind === "daily" ? `Journal · ${note.daily_date ?? ""}` : "Note"}
      </h1>

      <div className="grid max-w-3xl gap-4">
        <Panel title="Write">
          <NoteEditor noteId={note.id} title={note.title} body={note.body} pinned={note.pinned} />
        </Panel>

        <Panel title="Backlinks" hint={`${backlinks.length}`}>
          {backlinks.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">
              nothing links here yet — mention this note in another one with double brackets
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {backlinks.map((backlink) => (
                <li key={backlink.id} data-slot="backlink-row" className="font-mono text-xs">
                  <Link href={`/notes/${backlink.id}`} className="text-primary hover:underline">
                    {backlink.title === "" ? "(untitled)" : backlink.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/notes" className="font-mono text-xs text-muted-foreground hover:underline">
            ← all notes
          </Link>
        </Panel>
      </div>
    </>
  );
}
