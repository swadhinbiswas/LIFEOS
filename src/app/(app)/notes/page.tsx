import Link from "next/link";
import { redirect } from "next/navigation";

import { Panel } from "@/components/tui/panel";
import { getServerSession } from "@/server/auth/session";
import { listNotes, searchNotes } from "@/server/notes";

import { NewNote } from "./_components/new-note";

export const metadata = { title: "Notes" };

type PageProps = { searchParams: Promise<{ q?: string }> };

/**
 * `/notes` (spec §6.5): the library, full-text search and today's journal. With a query it goes
 * through the FTS5 index (migration 0005); with an empty box it is a recency list.
 */
export default async function NotesPage({ searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const hits =
    query === "" ? await listNotes(session.user.id) : await searchNotes(session.user.id, query);

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">Notes</h1>

      <div className="grid max-w-3xl gap-4">
        <Panel title="Start writing">
          <div className="flex flex-col gap-2">
            <NewNote />
            <form method="get" className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="note-search-input">
                search notes
              </label>
              <input
                id="note-search-input"
                name="q"
                defaultValue={query}
                placeholder="search notes…"
                className="w-64 border border-border bg-background px-2 py-1 font-mono text-xs outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                className="rounded-[var(--radius)] border border-border bg-background px-2 py-1 font-mono text-xs hover:bg-accent hover:text-accent-foreground"
              >
                search
              </button>
              {query !== "" ? (
                <Link
                  href="/notes"
                  className="font-mono text-[10px] text-muted-foreground hover:underline"
                >
                  clear
                </Link>
              ) : null}
            </form>
          </div>
        </Panel>

        <Panel title={query === "" ? "Recent" : "Matches"} hint={`${hits.length}`}>
          {hits.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">
              {query === ""
                ? "nothing yet — start a note or today's journal"
                : "no notes match that"}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {hits.map((note) => (
                <li
                  key={note.id}
                  data-slot="note-row"
                  className="flex flex-wrap items-baseline gap-2 border border-border px-2 py-1"
                >
                  <Link
                    href={`/notes/${note.id}`}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {note.title === "" ? "(untitled)" : note.title}
                  </Link>
                  {note.kind !== "note" ? (
                    <span className="font-mono text-[10px] text-muted-foreground">{note.kind}</span>
                  ) : null}
                  {note.pinned ? (
                    <span className="font-mono text-[10px] text-warning">pinned</span>
                  ) : null}
                  <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">
                    {note.excerpt}
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
