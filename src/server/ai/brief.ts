import type { LanguageModel } from "ai";
import { and, desc, eq, like } from "drizzle-orm";

import { db } from "@/server/db";
import { notifications } from "@/server/db/schema";
import { getAiPrefs } from "@/server/settings";

import { deliverProactive } from "./proactive";

/**
 * Reading and re-running the AI morning brief (spec section 8, ADR-106).
 *
 * deliverProactive has always written the brief into a "system" notification, and the only place
 * it was ever rendered was one truncated line in the notification list - the AI wrote something
 * and the user could not read it. This module is the read side plus a user-initiated re-run, so a
 * dashboard widget (or anything else) can show the brief in full and refresh it.
 *
 * The brief stays where it is stored. Re-running replaces today's row rather than adding one, so
 * the notification centre cannot accumulate duplicates, and the cron path is untouched: it still
 * dedupes on ai:brief:<day> and cannot double-send.
 */

export interface LatestBrief {
  title: string;
  /** The model's own text, in full. */
  body: string;
  createdAt: string;
  /** The day key the brief was written for (YYYY-MM-DD, the dedupe key's tail). */
  day: string;
  /** True when the brief on screen is today's; false when it is an older one. */
  isToday: boolean;
}

const dayKey = (now: Date): string => now.toISOString().slice(0, 10);

/**
 * The newest brief, preferring today's. Returns null when none was ever written, so the widget can
 * offer the opt-in instead of rendering an empty box.
 */
export async function latestBrief(
  userId: string,
  now: Date = new Date(),
): Promise<LatestBrief | null> {
  const [row] = await db
    .select({
      title: notifications.title,
      body: notifications.body,
      createdAt: notifications.created_at,
      dedupeKey: notifications.dedupe_key,
    })
    .from(notifications)
    .where(and(eq(notifications.user_id, userId), like(notifications.dedupe_key, "ai:brief:%")))
    .orderBy(desc(notifications.created_at))
    .limit(1);

  if (!row) return null;
  const day = (row.dedupeKey ?? "").split(":").at(-1) || dayKey(now);
  return {
    title: row.title,
    body: row.body ?? "",
    createdAt: row.createdAt.toISOString(),
    day,
    isToday: day === dayKey(now),
  };
}

/** Whether the user asked for proactive briefs at all, so the widget can say so. */
export async function briefEnabled(userId: string): Promise<boolean> {
  const prefs = await getAiPrefs(userId);
  return prefs.morningBrief !== "off";
}

export interface RegenerateResult {
  ok: boolean;
  /** A human-readable reason when ok is false. */
  reason?: string;
}

/**
 * Write today's brief again, replacing any brief already stored for today.
 *
 * Explicitly user-initiated: the cron never calls this. The opt-out is not a block - a user who
 * presses "regenerate" is asking for a brief right now, and hiding the button is enough. What it
 * will not do is email one: a re-run reuses the stored preference, so an in-app user stays in-app.
 */
export async function regenerateBrief(
  userId: string,
  now: Date = new Date(),
  modelOverride?: LanguageModel,
): Promise<RegenerateResult> {
  // Replace today's row so the notification centre keeps one brief per day.
  await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.user_id, userId),
        eq(notifications.dedupe_key, "ai:brief:" + dayKey(now)),
      ),
    );

  const result = await deliverProactive(userId, "brief", now, modelOverride);
  if (result.delivered) return { ok: true };
  return { ok: false, reason: result.skipped };
}
