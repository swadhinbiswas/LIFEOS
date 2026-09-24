import { and, asc, eq } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { saved_views } from "@/server/db/schema";

/**
 * Saved views (ERD §2.2, spec §6.1 "Saved views per board, shareable by URL"): a named,
 * per-user capture of the board URL state (view/filter/group/q). Sharing is just the URL —
 * this table only remembers the query for the owner, so no share permissions are needed
 * until the `shared` flag is actually used.
 */

export const SAVED_VIEW_SCOPES = ["tasks", "jobs", "board"] as const;
export type SavedViewScope = (typeof SAVED_VIEW_SCOPES)[number];

export interface SavedView {
  id: string;
  scope: string;
  name: string;
  /** The URL state, as a JSON string; parsed by the client and re-applied to nuqs. */
  query: string;
}

export async function listSavedViews(userId: string, scope: SavedViewScope): Promise<SavedView[]> {
  return db
    .select({
      id: saved_views.id,
      scope: saved_views.scope,
      name: saved_views.name,
      query: saved_views.query,
    })
    .from(saved_views)
    .where(and(eq(saved_views.user_id, userId), eq(saved_views.scope, scope)))
    .orderBy(asc(saved_views.name));
}

export async function createSavedView(
  userId: string,
  input: { scope: SavedViewScope; name: string; query: Record<string, string> },
): Promise<SavedView> {
  const [row] = await db
    .insert(saved_views)
    .values({
      id: newId(),
      user_id: userId,
      scope: input.scope,
      name: input.name,
      query: JSON.stringify(input.query),
    })
    .returning({
      id: saved_views.id,
      scope: saved_views.scope,
      name: saved_views.name,
      query: saved_views.query,
    });
  if (!row) throw new Error("saved view insert returned no row");
  return row;
}

/** Deleting an unknown id is a no-op: the caller's filter already scoped it to the owner. */
export async function deleteSavedView(userId: string, id: string): Promise<void> {
  await db.delete(saved_views).where(and(eq(saved_views.id, id), eq(saved_views.user_id, userId)));
}
