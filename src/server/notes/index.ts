import { and, desc, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { note_links, notes } from "@/server/db/schema";
import { getUserDayKey } from "@/server/settings";
import { emitEvent } from "@/server/webhooks";

import { extractWikiLinks, toPlainText } from "./wiki";

/**
 * Notes and journal (spec §6.5). Markdown is stored verbatim; the FTS5 `search_index` (migration
 * 0005) is written **in the same service call** as the note, so the index cannot drift, and
 * `[[wiki-links]]` become edges in `note_links` — the backlink panel is a query, not a scan.
 */

export type NoteRow = typeof notes.$inferSelect;

export interface NoteSummary {
  id: string;
  title: string;
  excerpt: string;
  kind: string;
  pinned: boolean;
  secret: boolean;
  dailyDate: string | null;
  updatedAt: Date;
}

export interface SearchHit extends NoteSummary {
  snippet: string;
}

const excerpt = (body: string): string => toPlainText(body).slice(0, 140);

const toSummary = (note: NoteRow): NoteSummary => ({
  id: note.id,
  title: note.title,
  excerpt: excerpt(note.body),
  kind: note.kind,
  pinned: note.pinned,
  secret: note.secret,
  dailyDate: note.daily_date,
  updatedAt: note.updated_at,
});

async function indexNote(note: NoteRow): Promise<void> {
  await db.run(sql`delete from search_index where note_id = ${note.id}`);
  // Secret notes are never indexed, so they cannot surface through full-text search even if a
  // caller holds a stale id (ADR-136). Flipping the flag re-runs this and rebuilds the row.
  if (note.secret) return;
  await db.run(
    sql`insert into search_index (title, body, note_id) values (${note.title}, ${note.body}, ${note.id})`,
  );
}

/** Resolve `[[Title]]` references to this user's notes and refresh this note's outgoing edges. */
async function syncLinks(userId: string, note: NoteRow): Promise<void> {
  const titles = extractWikiLinks(note.body);
  await db
    .delete(note_links)
    .where(and(eq(note_links.user_id, userId), eq(note_links.src_note_id, note.id)));
  if (titles.length === 0) return;

  const targets = await db
    .select({ id: notes.id, title: notes.title })
    .from(notes)
    .where(and(eq(notes.user_id, userId), isNull(notes.deleted_at), inArray(notes.title, titles)));

  for (const target of targets) {
    if (target.id === note.id) continue;
    await db
      .insert(note_links)
      .values({ id: newId(), user_id: userId, src_note_id: note.id, dst_note_id: target.id })
      .onConflictDoNothing();
  }
}

/**
 * When a note is created or renamed, other notes may already reference that title. Rebuilding
 * those outgoing edges is what makes `[[links]]` order-independent: writing the reference before
 * the note exists is normal, and the backlink must appear either way.
 */
async function resolveIncoming(userId: string, title: string): Promise<void> {
  const wanted = title.trim();
  if (wanted === "") return;
  const sources = await db
    .select()
    .from(notes)
    .where(
      and(
        eq(notes.user_id, userId),
        isNull(notes.deleted_at),
        sql`${notes.body} like ${`%[[${wanted}]]%`}`,
      ),
    );
  for (const source of sources) {
    await syncLinks(userId, source);
  }
}

export async function listNotes(
  userId: string,
  options: { kind?: string; limit?: number; includeSecret?: boolean } = {},
): Promise<NoteSummary[]> {
  const filters = [eq(notes.user_id, userId), isNull(notes.deleted_at)];
  if (options.kind) filters.push(eq(notes.kind, options.kind));
  // Secret notes are hidden from API reads by default (ADR-136): the service's default is the safe
  // one, and the owner opts in from the web UI. A caller that forgets the flag gets the safe list.
  if (!options.includeSecret) filters.push(eq(notes.secret, false));

  const rows = await db
    .select()
    .from(notes)
    .where(and(...filters))
    .orderBy(desc(notes.pinned), desc(notes.updated_at))
    .limit(options.limit ?? 100);

  return rows.map(toSummary);
}

export async function getNote(
  userId: string,
  noteId: string,
  options: { includeSecret?: boolean } = {},
): Promise<{ note: NoteRow; backlinks: NoteSummary[] } | null> {
  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.user_id, userId), isNull(notes.deleted_at)))
    .limit(1);
  if (!note) return null;
  // A secret note requested without opt-in is indistinguishable from a missing one — the same
  // answer the API gives for a note that does not exist, so a probe cannot tell them apart.
  if (note.secret && !options.includeSecret) return null;

  const linking = await db
    .select({ srcNoteId: note_links.src_note_id })
    .from(note_links)
    .where(and(eq(note_links.user_id, userId), eq(note_links.dst_note_id, noteId)));
  if (linking.length === 0) return { note, backlinks: [] };

  const backlinkRows = await db
    .select()
    .from(notes)
    .where(
      and(
        eq(notes.user_id, userId),
        isNull(notes.deleted_at),
        inArray(
          notes.id,
          linking.map((row) => row.srcNoteId),
        ),
      ),
    );
  return { note, backlinks: backlinkRows.map(toSummary) };
}

export async function createNote(
  userId: string,
  input: {
    title?: string;
    body?: string;
    kind?: string;
    dailyDate?: string | null;
    secret?: boolean;
  },
): Promise<NoteRow> {
  const [row] = await db
    .insert(notes)
    .values({
      id: newId(),
      user_id: userId,
      title: input.title?.trim() ?? "",
      body: input.body ?? "",
      kind: input.kind ?? "note",
      daily_date: input.dailyDate ?? null,
      secret: input.secret ?? false,
    })
    .returning();
  if (!row) throw new Error("note insert returned no row");
  await indexNote(row);
  await syncLinks(userId, row);
  await resolveIncoming(userId, row.title);
  await emitEvent(userId, "note.created", { id: row.id, title: row.title, kind: row.kind });
  return row;
}

export async function updateNote(
  userId: string,
  input: {
    noteId: string;
    title?: string;
    body?: string;
    pinned?: boolean;
    archived?: boolean;
    secret?: boolean;
  },
): Promise<NoteRow> {
  const patch: Partial<typeof notes.$inferInsert> = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.body !== undefined) patch.body = input.body;
  if (input.pinned !== undefined) patch.pinned = input.pinned;
  if (input.archived !== undefined) patch.archived_at = input.archived ? new Date() : null;
  if (input.secret !== undefined) patch.secret = input.secret;

  const [row] = await db
    .update(notes)
    .set(patch)
    .where(and(eq(notes.id, input.noteId), eq(notes.user_id, userId), isNull(notes.deleted_at)))
    .returning();
  if (!row) throw new Error("note not found");
  await indexNote(row);
  await syncLinks(userId, row);
  if (input.title !== undefined) await resolveIncoming(userId, row.title);
  return row;
}

/** Soft delete keeps the row for the trash; the FTS row is removed so search never shows it. */
export async function deleteNote(userId: string, noteId: string): Promise<void> {
  const [row] = await db
    .update(notes)
    .set({ deleted_at: new Date() })
    .where(and(eq(notes.id, noteId), eq(notes.user_id, userId)))
    .returning();
  if (!row) throw new Error("note not found");
  await db.run(sql`delete from search_index where note_id = ${noteId}`);
}

/**
 * Trash (spec §6.9, ADR-048). Deleting removed the FTS row, so restoring must re-index and
 * re-sync links — otherwise the note would exist but be unfindable and unlinked.
 */
export async function listTrashedNotes(userId: string): Promise<NoteRow[]> {
  return db
    .select()
    .from(notes)
    .where(and(eq(notes.user_id, userId), isNotNull(notes.deleted_at)))
    .orderBy(desc(notes.deleted_at));
}

export async function restoreNote(userId: string, noteId: string): Promise<void> {
  const [row] = await db
    .update(notes)
    .set({ deleted_at: null })
    .where(and(eq(notes.id, noteId), eq(notes.user_id, userId), isNotNull(notes.deleted_at)))
    .returning();
  if (!row) throw new Error("note is not in the trash");
  await indexNote(row);
  await syncLinks(userId, row);
  await resolveIncoming(userId, row.title);
}

/** Hard delete, only ever a note already trashed — a mis-click cannot destroy live work. */
export async function purgeNote(userId: string, noteId: string): Promise<void> {
  await db
    .delete(notes)
    .where(and(eq(notes.id, noteId), eq(notes.user_id, userId), isNotNull(notes.deleted_at)));
}

/** Permanently delete trashed notes past the retention window. Returns how many rows went. */
export async function purgeTrashedNotes(
  userId: string,
  olderThanDays = 30,
  now: Date = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - olderThanDays * 24 * 60 * 60 * 1000);
  const removed = await db
    .delete(notes)
    .where(
      and(eq(notes.user_id, userId), isNotNull(notes.deleted_at), lt(notes.deleted_at, cutoff)),
    )
    .returning({ id: notes.id });
  for (const note of removed) {
    await db.run(sql`delete from search_index where note_id = ${note.id}`);
  }
  return removed.length;
}

/** Today's note, created on first open and found again afterwards (spec §6.5). */
export async function dailyNote(userId: string, date?: string): Promise<NoteRow> {
  const day = date ?? (await getUserDayKey(userId));
  const [existing] = await db
    .select()
    .from(notes)
    .where(
      and(
        eq(notes.user_id, userId),
        eq(notes.kind, "daily"),
        eq(notes.daily_date, day),
        isNull(notes.deleted_at),
      ),
    )
    .limit(1);
  if (existing) return existing;
  return createNote(userId, { kind: "daily", dailyDate: day, title: day });
}

/**
 * Full-text search over the user's live notes. Tokens are sanitised to bare words and each gets a
 * prefix wildcard, so FTS operators a user types can never turn into a syntax error.
 */
export async function searchNotes(userId: string, query: string, limit = 20): Promise<SearchHit[]> {
  const tokens = query
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}_-]/gu, ""))
    .filter((token) => token.length > 0);
  if (tokens.length === 0) return [];

  const match = tokens.map((token) => `${token}*`).join(" ");
  const hits = await db.all<{ note_id: string; snippet: string }>(
    sql`select note_id, snippet(search_index, 1, '[', ']', '…', 12) as snippet
        from search_index where search_index match ${match} limit ${limit * 3}`,
  );
  if (hits.length === 0) return [];

  const ids = hits.map((hit) => hit.note_id);
  const rows = await db
    .select()
    .from(notes)
    .where(
      and(
        eq(notes.user_id, userId),
        isNull(notes.deleted_at),
        eq(notes.secret, false),
        inArray(notes.id, ids),
      ),
    );

  const byId = new Map(rows.map((row) => [row.id, row]));
  return hits
    .map((hit) => {
      const note = byId.get(hit.note_id);
      return note ? { ...toSummary(note), snippet: hit.snippet } : null;
    })
    .filter((hit): hit is SearchHit => hit !== null)
    .slice(0, limit);
}
