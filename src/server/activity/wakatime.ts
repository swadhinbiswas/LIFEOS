import { and, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";

import {
  decryptSecret,
  encryptSecret,
  isEncryptionConfigured,
  maskSecret,
} from "@/server/ai/crypto";
import { newId } from "@/lib/id";
import { DEFAULT_TIME_ZONE, dayKeyInTimeZone, shiftDayKey } from "@/lib/timezone";
import { db } from "@/server/db";
import { activity_connections, code_activity_daily } from "@/server/db/schema";

/**
 * WakaTime activity (ADR-110). This module is the only writer of `activity_connections` and
 * `code_activity_daily`.
 *
 * WakaTime already aggregates every plugin, the CLI, the official OpenCode plugin and the user own
 * phone app behind one account, so LifeOS pulls rather than re-implementing heartbeats " + String.fromCharCode(8212) + " the
 * provider docs say an integration should not POST heartbeats itself. Endpoints, auth and response
 * shape below were taken from the official developer docs on 2026-09-26:
 *
 * - base `https://api.wakatime.com/api/v1/`
 * - `Authorization: Basic base64(apiKey)`
 * - `GET /users/current/summaries?start=YYYY-MM-DD&end=YYYY-MM-DD`
 * - each day reports `grand_total` with `total_seconds` plus `ai_additions`, `ai_deletions`,
 *   `human_additions`, `human_deletions` and `ai_model_total_cost`, alongside `languages`,
 *   `editors` and `projects` arrays.
 *
 * Every number stored here is the provider own; nothing is inferred or recomputed. A failed sync is
 * fail-open: the previously cached days stay and the error is recorded on the connection.
 */

export const WAKATIME_PROVIDER = "wakatime";
const API_BASE = "https://api.wakatime.com/api/v1";
const SYNC_TIMEOUT_MS = 8_000;
const MAX_SYNC_DAYS = 90;

/* -------------------------------------------------------------------------- */
/* The wire shape, validated at the boundary (spec §10) rather than trusted.                     */
/* -------------------------------------------------------------------------- */

const breakdown = z
  .array(z.object({ name: z.string(), total_seconds: z.number().default(0) }))
  .catch([]);

const summarySchema = z.object({
  grand_total: z
    .object({
      total_seconds: z.number().default(0),
      ai_additions: z.number().int().nonnegative().optional(),
      ai_deletions: z.number().int().nonnegative().optional(),
      human_additions: z.number().int().nonnegative().optional(),
      human_deletions: z.number().int().nonnegative().optional(),
      ai_model_total_cost: z.number().nonnegative().optional(),
    })
    .catch({ total_seconds: 0 }),
  languages: breakdown.optional(),
  editors: breakdown.optional(),
  projects: breakdown.optional(),
});

const summariesResponse = z.object({ data: z.array(summarySchema).catch([]) });

export interface DailyActivity {
  day: string;
  seconds: number;
  aiAdditions: number;
  aiDeletions: number;
  humanAdditions: number;
  humanDeletions: number;
  aiCostUsd: number;
  languages: Array<{ name: string; seconds: number }>;
  editors: Array<{ name: string; seconds: number }>;
  projects: Array<{ name: string; seconds: number }>;
}

const top = (
  rows: Array<{ name: string; seconds: number }> | undefined,
  limit = 5,
): Array<{ name: string; seconds: number }> =>
  [...(rows ?? [])].sort((a, b) => b.seconds - a.seconds).slice(0, limit);

/**
 * Wire shape to a row, kept pure so it can be tested against a documented fixture without a
 * network or a database. Days missing from the response are absent, not zero-filled: the dashboard
 * decides how to present a gap (ADR-110).
 */
export function mapSummaries(
  raw: unknown,
  fallbackDay: (index: number) => string,
): DailyActivity[] {
  const parsed = summariesResponse.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data.data.map((summary, index) => {
    const total = summary.grand_total;
    return {
      day: fallbackDay(index),
      seconds: Math.round(total.total_seconds),
      aiAdditions: total.ai_additions ?? 0,
      aiDeletions: total.ai_deletions ?? 0,
      humanAdditions: total.human_additions ?? 0,
      humanDeletions: total.human_deletions ?? 0,
      aiCostUsd: total.ai_model_total_cost ?? 0,
      languages: top(
        summary.languages?.map((row) => ({ name: row.name, seconds: row.total_seconds })),
      ),
      editors: top(summary.editors?.map((row) => ({ name: row.name, seconds: row.total_seconds }))),
      projects: top(
        summary.projects?.map((row) => ({ name: row.name, seconds: row.total_seconds })),
      ),
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Connection                                                                                     */
/* -------------------------------------------------------------------------- */

export interface ConnectionSummary {
  provider: string;
  /** Masked key " + String.fromCharCode(8212) + " the only part of the secret ever returned. */
  hint: string;
  lastSyncedAt: Date | null;
  lastError: string | null;
}

export async function saveConnection(userId: string, apiKey: string): Promise<ConnectionSummary> {
  if (!isEncryptionConfigured()) {
    throw new Error("an activity key cannot be stored: AI_ENCRYPTION_KEY is not set");
  }
  const key = apiKey.trim();
  if (key.length < 8) throw new Error("that key looks too short");

  const [row] = await db
    .insert(activity_connections)
    .values({
      id: newId(),
      user_id: userId,
      provider: WAKATIME_PROVIDER,
      secret_encrypted: encryptSecret(key),
      hint: maskSecret(key),
    })
    .onConflictDoUpdate({
      target: [activity_connections.user_id, activity_connections.provider],
      set: { secret_encrypted: encryptSecret(key), hint: maskSecret(key), last_error: null },
    })
    .returning();
  if (!row) throw new Error("could not store the connection");
  return {
    provider: row.provider,
    hint: row.hint,
    lastSyncedAt: row.last_synced_at,
    lastError: row.last_error,
  };
}

export async function getConnection(userId: string): Promise<ConnectionSummary | null> {
  const [row] = await db
    .select()
    .from(activity_connections)
    .where(
      and(
        eq(activity_connections.user_id, userId),
        eq(activity_connections.provider, WAKATIME_PROVIDER),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    provider: row.provider,
    hint: row.hint,
    lastSyncedAt: row.last_synced_at,
    lastError: row.last_error,
  };
}

export async function deleteConnection(userId: string): Promise<void> {
  await db
    .delete(activity_connections)
    .where(
      and(
        eq(activity_connections.user_id, userId),
        eq(activity_connections.provider, WAKATIME_PROVIDER),
      ),
    );
}

/* -------------------------------------------------------------------------- */
/* Sync                                                                                          */
/* -------------------------------------------------------------------------- */

export interface SyncResult {
  ok: boolean;
  days: number;
  /** Present when ok is false, already trimmed to something safe to show. */
  error?: string;
}

const authHeader = (apiKey: string): string =>
  "Basic " + Buffer.from(apiKey + ":", "utf8").toString("base64");

/** An answer the provider did give us, as opposed to a request that never got one. */
class ProviderError extends Error {}

/**
 * Why a sync failed, in words a person can act on. A rejected key is the common case, so it is
 * named rather than folded into a generic network error: "could not be reached" would send
 * someone hunting a firewall that is not the problem.
 */
function describeSyncFailure(error: unknown): string {
  if (error instanceof ProviderError) return error.message;
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return "the provider did not answer in time";
  }
  return "the provider could not be reached";
}

export async function syncWakaTime(
  userId: string,
  days = 30,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): Promise<SyncResult> {
  const connection = await getConnection(userId);
  if (!connection) return { ok: false, days: 0, error: "not connected" };

  const [row] = await db
    .select({ secret: activity_connections.secret_encrypted })
    .from(activity_connections)
    .where(
      and(
        eq(activity_connections.user_id, userId),
        eq(activity_connections.provider, WAKATIME_PROVIDER),
      ),
    )
    .limit(1);
  if (!row) return { ok: false, days: 0, error: "not connected" };

  const window = Math.min(MAX_SYNC_DAYS, Math.max(1, Math.round(days)));
  const last = dayKeyInTimeZone(now, timeZone);
  const first = shiftDayKey(last, -(window - 1));

  let payload: unknown;
  try {
    const url =
      API_BASE +
      "/users/current/summaries?start=" +
      encodeURIComponent(first) +
      "&end=" +
      encodeURIComponent(last);
    const response = await fetch(url, {
      headers: {
        Authorization: authHeader(decryptSecret(row.secret)),
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new ProviderError(
        response.status === 401 || response.status === 403
          ? "the provider rejected the API key"
          : "the provider answered " + String(response.status),
      );
    }
    payload = await response.json();
  } catch (error) {
    // Fail-open: the cached days stay exactly as they were, and the reason is shown in place.
    const message = describeSyncFailure(error);
    await db
      .update(activity_connections)
      .set({ last_error: message })
      .where(
        and(
          eq(activity_connections.user_id, userId),
          eq(activity_connections.provider, WAKATIME_PROVIDER),
        ),
      );
    return { ok: false, days: 0, error: message };
  }

  const rows = mapSummaries(payload, (index) => shiftDayKey(first, index));
  if (rows.length > 0) {
    await db
      .insert(code_activity_daily)
      .values(
        rows.map((day) => ({
          id: newId(),
          user_id: userId,
          day: day.day,
          total_seconds: day.seconds,
          ai_additions: day.aiAdditions,
          ai_deletions: day.aiDeletions,
          human_additions: day.humanAdditions,
          human_deletions: day.humanDeletions,
          ai_cost_usd: day.aiCostUsd,
          languages: JSON.stringify(day.languages),
          editors: JSON.stringify(day.editors),
          projects: JSON.stringify(day.projects),
        })),
      )
      // One row per user and day: a re-sync overwrites, so a retry cannot double-count.
      .onConflictDoUpdate({
        target: [code_activity_daily.user_id, code_activity_daily.day],
        set: {
          total_seconds: sql`excluded.total_seconds`,
          ai_additions: sql`excluded.ai_additions`,
          ai_deletions: sql`excluded.ai_deletions`,
          human_additions: sql`excluded.human_additions`,
          human_deletions: sql`excluded.human_deletions`,
          ai_cost_usd: sql`excluded.ai_cost_usd`,
          languages: sql`excluded.languages`,
          editors: sql`excluded.editors`,
          projects: sql`excluded.projects`,
          updated_at: new Date(),
        },
      });
  }

  await db
    .update(activity_connections)
    .set({ last_synced_at: now, last_error: null })
    .where(
      and(
        eq(activity_connections.user_id, userId),
        eq(activity_connections.provider, WAKATIME_PROVIDER),
      ),
    );
  return { ok: true, days: rows.length };
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                                         */
/* -------------------------------------------------------------------------- */

export interface ActivityDay extends DailyActivity {
  /** Set when the row aggregates a range rather than a single day. */
  languages: Array<{ name: string; seconds: number }>;
}

const parseList = (raw: string): Array<{ name: string; seconds: number }> => {
  try {
    const parsed = z
      .array(z.object({ name: z.string(), seconds: z.number() }))
      .safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
};

/** The cached days, oldest first, for the dashboard. No network call: a chart must not block on it. */
export async function activitySeries(
  userId: string,
  days = 30,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): Promise<ActivityDay[]> {
  const window = Math.min(MAX_SYNC_DAYS, Math.max(1, Math.round(days)));
  const last = dayKeyInTimeZone(now, timeZone);
  const first = shiftDayKey(last, -(window - 1));

  const rows = await db
    .select()
    .from(code_activity_daily)
    .where(
      and(
        eq(code_activity_daily.user_id, userId),
        gte(code_activity_daily.day, first),
        lte(code_activity_daily.day, last),
      ),
    )
    .orderBy(code_activity_daily.day);

  return rows.map((row) => ({
    day: row.day,
    seconds: row.total_seconds,
    aiAdditions: row.ai_additions,
    aiDeletions: row.ai_deletions,
    humanAdditions: row.human_additions,
    humanDeletions: row.human_deletions,
    aiCostUsd: row.ai_cost_usd,
    languages: parseList(row.languages),
    editors: parseList(row.editors),
    projects: parseList(row.projects),
  }));
}

/* -------------------------------------------------------------------------- */
/* Scheduled freshness (ADR-129)                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * How often one account is refreshed, and how much history a tick re-reads.
 *
 * `minIntervalMs` is the throttle, and it is deliberately enforced **here** rather than left to the
 * scheduler. "Every hour" has to mean *at most* once an hour: a scheduler that fires every fifteen
 * minutes, a retry, or a curious person hitting the route must not turn into four WakaTime calls an
 * hour against someone's real account.
 *
 * The window is **two days, not thirty**, and that is the whole trick. A finished day does not
 * change, so re-reading a month of summaries every hour spends a month's worth of API calls to
 * discover nothing. Today is still accruing and yesterday can still move — an offline editor
 * uploading late, a clock skew, a day boundary in the provider's own timezone. Two days is the
 * smallest window that keeps the chart current without doing work nobody reads.
 */
export const ACTIVITY_REFRESH = {
  minIntervalMs: 60 * 60 * 1000,
  windowDays: 2,
  provider: WAKATIME_PROVIDER,
} as const;

/** One account awaiting a refresh, with enough context to decide whether it is due. */
export interface DueConnection {
  userId: string;
  lastSyncedAt: Date | null;
}

/**
 * Every account with a WakaTime connection, and when each was last refreshed.
 *
 * `last_error` is deliberately *not* filtered on: a connection that failed is exactly the one that
 * needs retrying, and hiding it would make a broken integration look like no integration at all.
 */
export async function listDueActivityConnections(): Promise<DueConnection[]> {
  const rows = await db
    .select({
      userId: activity_connections.user_id,
      lastSyncedAt: activity_connections.last_synced_at,
    })
    .from(activity_connections)
    .where(eq(activity_connections.provider, WAKATIME_PROVIDER));
  return rows.map((row) => ({ userId: row.userId, lastSyncedAt: row.lastSyncedAt }));
}

/** Whether this account is past its refresh interval. `lastSyncedAt === null` means never synced. */
export function isDue(lastSyncedAt: Date | null, now: Date = new Date()): boolean {
  if (!lastSyncedAt) return true;
  return now.getTime() - lastSyncedAt.getTime() >= ACTIVITY_REFRESH.minIntervalMs;
}

/** A merged top-N across the window, for the meters: the provider own numbers, summed. */
export function topAcross(
  series: ActivityDay[],
  field: "languages" | "editors" | "projects",
  limit = 5,
): Array<{ name: string; seconds: number }> {
  const totals = new Map<string, number>();
  for (const day of series) {
    for (const row of day[field]) {
      totals.set(row.name, (totals.get(row.name) ?? 0) + row.seconds);
    }
  }
  return [...totals]
    .map(([name, seconds]) => ({ name, seconds }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, limit);
}

export const activityLimits = {
  maxSyncDays: MAX_SYNC_DAYS,
  timeoutMs: SYNC_TIMEOUT_MS,
  provider: WAKATIME_PROVIDER,
};
