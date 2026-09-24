import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { cards, notes, taggings, tags } from "@/server/db/schema";

/**
 * Tags (spec §6.9, ADR-049/059). The generic cross-module tagging system: a `tag` is a name, a
 * `tagging` is the edge to one entity. Board **labels** stay card-scoped (colour + board filter);
 * these tags are the cross-module concept and cover notes and cards.
 */

export type TaggableType = "note" | "card";

export interface TagCount {
  name: string;
  count: number;
}

/** Trim, lower-case, drop a leading `#`, collapse whitespace, cap the length. */
export const normalizeTag = (name: string): string =>
  name.trim().toLowerCase().replace(/^#+/, "").replace(/\s+/g, " ").slice(0, 40);

/** Split a comma/newline separated field into unique, normalised tags. */
export function parseTagInput(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(/[,\n]/)) {
    const tag = normalizeTag(part);
    if (tag !== "") seen.add(tag);
  }
  return [...seen];
}

/** Every tag the user has, most used first — the filter bar and a rough health read. */
export async function listTags(userId: string): Promise<TagCount[]> {
  const rows = await db
    .select({ name: tags.name, count: sql<number>`count(${taggings.id})` })
    .from(tags)
    .leftJoin(taggings, and(eq(taggings.tag_id, tags.id), eq(taggings.user_id, userId)))
    .where(eq(tags.user_id, userId))
    .groupBy(tags.id)
    .orderBy(desc(sql`count(${taggings.id})`), tags.name);
  return rows.map((row) => ({ name: row.name, count: Number(row.count) }));
}

export async function getTags(userId: string, type: TaggableType, id: string): Promise<string[]> {
  const rows = await db
    .select({ name: tags.name })
    .from(taggings)
    .innerJoin(tags, eq(tags.id, taggings.tag_id))
    .where(
      and(
        eq(taggings.user_id, userId),
        eq(taggings.taggable_type, type),
        eq(taggings.taggable_id, id),
      ),
    )
    .orderBy(tags.name);
  return rows.map((row) => row.name);
}

/** Tags for many entities at once — one query for a list page. */
export async function listTagsForMany(
  userId: string,
  type: TaggableType,
  ids: string[],
): Promise<Record<string, string[]>> {
  if (ids.length === 0) return {};
  const rows = await db
    .select({ entityId: taggings.taggable_id, name: tags.name })
    .from(taggings)
    .innerJoin(tags, eq(tags.id, taggings.tag_id))
    .where(
      and(
        eq(taggings.user_id, userId),
        eq(taggings.taggable_type, type),
        inArray(taggings.taggable_id, ids),
      ),
    )
    .orderBy(tags.name);
  const byEntity: Record<string, string[]> = {};
  for (const row of rows) (byEntity[row.entityId] ??= []).push(row.name);
  return byEntity;
}

/** Ids carrying `name` — how the notes library filters without joining in the notes service. */
export async function listIdsByTag(
  userId: string,
  type: TaggableType,
  name: string,
): Promise<string[]> {
  const rows = await db
    .select({ entityId: taggings.taggable_id })
    .from(taggings)
    .innerJoin(tags, eq(tags.id, taggings.tag_id))
    .where(
      and(
        eq(taggings.user_id, userId),
        eq(taggings.taggable_type, type),
        eq(tags.name, normalizeTag(name)),
      ),
    );
  return rows.map((row) => row.entityId);
}

/**
 * Replace an entity's tags in one call: upsert the names, swap the edges, then drop tag rows
 * nothing references. Validates that the entity belongs to the user, so a forged id cannot tag
 * someone else's note or card.
 */
export async function setTags(
  userId: string,
  input: { type: TaggableType; id: string; names: string[] },
): Promise<string[]> {
  if (input.type === "note") {
    const [note] = await db
      .select({ id: notes.id })
      .from(notes)
      .where(and(eq(notes.id, input.id), eq(notes.user_id, userId), isNull(notes.deleted_at)))
      .limit(1);
    if (!note) throw new Error("note not found");
  } else {
    const [card] = await db
      .select({ id: cards.id })
      .from(cards)
      .where(and(eq(cards.id, input.id), eq(cards.user_id, userId), isNull(cards.deleted_at)))
      .limit(1);
    if (!card) throw new Error("card not found");
  }

  const wanted = [...new Set(input.names.map(normalizeTag).filter((name) => name !== ""))];

  for (const name of wanted) {
    await db
      .insert(tags)
      .values({ id: newId(), user_id: userId, name })
      .onConflictDoNothing({ target: [tags.user_id, tags.name] });
  }

  await db
    .delete(taggings)
    .where(
      and(
        eq(taggings.user_id, userId),
        eq(taggings.taggable_type, input.type),
        eq(taggings.taggable_id, input.id),
      ),
    );

  if (wanted.length > 0) {
    const rows = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.user_id, userId), inArray(tags.name, wanted)));
    if (rows.length > 0) {
      await db
        .insert(taggings)
        .values(
          rows.map((tag) => ({
            id: newId(),
            user_id: userId,
            tag_id: tag.id,
            taggable_type: input.type,
            taggable_id: input.id,
          })),
        )
        .onConflictDoNothing();
    }
  }

  // A tag nothing is tagged with is not a tag; prune so the filter bar stays honest.
  await db.run(
    sql`delete from tags where user_id = ${userId} and id not in (select tag_id from taggings where user_id = ${userId})`,
  );

  return wanted;
}
