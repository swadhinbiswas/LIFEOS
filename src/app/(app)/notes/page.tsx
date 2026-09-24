import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { getServerSession } from "@/server/auth/session";
import { listNotes, searchNotes } from "@/server/notes";
import { listIdsByTag, listTags, listTagsForMany } from "@/server/tags";

import { NewNote } from "./_components/new-note";

export const metadata = { title: "Notes" };

type PageProps = { searchParams: Promise<{ q?: string; tag?: string }> };

/**
 * `/notes` (spec §6.5, §6.9): the library, full-text search, today's journal and a tag filter.
 * Search goes through the FTS5 index (migration 0005); tags come from the shared tags service
 * (ADR-049), and filtering is a tag-id set so the two mechanisms compose.
 */
export default async function NotesPage({ searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Notes");
  const { q, tag } = await searchParams;
  const query = (q ?? "").trim();
  const activeTag = (tag ?? "").trim();

  const [allTags, initialHits] = await Promise.all([
    listTags(session.user.id),
    query === "" ? listNotes(session.user.id) : searchNotes(session.user.id, query),
  ]);

  const taggedIds =
    activeTag === "" ? null : new Set(await listIdsByTag(session.user.id, "note", activeTag));
  const hits = taggedIds ? initialHits.filter((note) => taggedIds.has(note.id)) : initialHits;
  const tagsByNote = await listTagsForMany(
    session.user.id,
    "note",
    hits.map((note) => note.id),
  );

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">
        {t("title")}
      </h1>

      <div className="grid max-w-3xl gap-4">
        <Panel title={t("startWriting")}>
          <div className="flex flex-col gap-2">
            <NewNote />
            <form method="get" className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="note-search-input">
                {t("searchLabel")}
              </label>
              <input
                id="note-search-input"
                name="q"
                defaultValue={query}
                placeholder={t("searchPlaceholder")}
                className="w-64 border border-border bg-background px-2 py-1 font-mono text-xs outline-none placeholder:text-muted-foreground"
              />
              {activeTag !== "" ? <input type="hidden" name="tag" value={activeTag} /> : null}
              <button
                type="submit"
                className="rounded-[var(--radius)] border border-border bg-background px-2 py-1 font-mono text-xs hover:bg-accent hover:text-accent-foreground"
              >
                {t("search")}
              </button>
              {query !== "" || activeTag !== "" ? (
                <Link
                  href="/notes"
                  className="font-mono text-[10px] text-muted-foreground hover:underline"
                >
                  {t("clear")}
                </Link>
              ) : null}
            </form>

            {allTags.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2" data-slot="tag-filter">
                <span className="font-mono text-[10px] text-muted-foreground">{t("tags")}</span>
                {allTags.map((entry) => (
                  <Link
                    key={entry.name}
                    href={
                      activeTag === entry.name
                        ? "/notes"
                        : `/notes?tag=${encodeURIComponent(entry.name)}`
                    }
                    aria-current={activeTag === entry.name ? "true" : undefined}
                    className={
                      activeTag === entry.name
                        ? "font-mono text-[10px] text-foreground underline"
                        : "font-mono text-[10px] text-muted-foreground hover:underline"
                    }
                  >
                    {entry.name} ({entry.count})
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel
          title={
            activeTag === ""
              ? query === ""
                ? t("recent")
                : t("matches")
              : t("tagged", { tag: activeTag })
          }
          hint={`${hits.length}`}
        >
          {hits.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">
              {activeTag !== ""
                ? t("emptyTagged")
                : query === ""
                  ? t("emptyNone")
                  : t("emptyNoMatch")}
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
                    {note.title === "" ? t("untitled") : note.title}
                  </Link>
                  {note.kind !== "note" ? (
                    <span className="font-mono text-[10px] text-muted-foreground">{note.kind}</span>
                  ) : null}
                  {note.pinned ? (
                    <span className="font-mono text-[10px] text-warning">{t("pinned")}</span>
                  ) : null}
                  {(tagsByNote[note.id] ?? []).map((name) => (
                    <span
                      key={name}
                      data-slot="note-tag"
                      className="font-mono text-[10px] text-info"
                    >
                      #{name}
                    </span>
                  ))}
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
