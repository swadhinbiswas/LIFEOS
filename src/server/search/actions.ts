"use server";

import { z } from "zod";

import { getServerSession } from "@/server/auth/session";
import type { ActionResult } from "@/server/boards/actions";
import { search, type SearchResults } from "@/server/search";

/** Palette search adapter (spec §4.3). Read-only, so no mutation surface to guard. */

const searchInput = z.object({ query: z.string().trim().max(200) });

export async function searchAction(input: unknown): Promise<ActionResult<SearchResults>> {
  const session = await getServerSession();
  if (!session) return { ok: false, code: "unauthorized", message: "you are signed out" };

  const parsed = searchInput.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid", message: "that query is not valid" };

  try {
    return { ok: true, data: await search(session.user.id, parsed.data.query) };
  } catch (error) {
    console.error("[search] failed", error);
    return { ok: false, code: "invalid", message: "search is unavailable right now" };
  }
}
