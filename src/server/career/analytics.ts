import { and, eq, isNull } from "drizzle-orm";

import {
  DEFAULT_TIME_ZONE,
  dayKeyInTimeZone,
  startOfWeekInTimeZone,
  type WeekStart,
} from "@/lib/timezone";
import { db } from "@/server/db";
import { cards, job_applications } from "@/server/db/schema";
import { getBoard } from "@/server/boards";
import { shiftDay } from "@/server/habits/streak";

import { ensureJobBoard, getFunnel, type Funnel } from "./index";

/**
 * Career analytics beyond the funnel (spec §6.3): response rate **by source**, applications per
 * week, and "ghosted" detection (no stage change for N days). Everything is derived from the
 * append-only stage history and the board (ADR-044) — there is no summary table to drift.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKS = 8;
/** Terminal stages: a job here is finished, not ghosted. */
const TERMINAL_STAGES = new Set(["Accepted", "Rejected", "Withdrawn"]);

export interface SourceRow {
  source: string;
  total: number;
  progressed: number;
  rate: number;
}

export interface WeekRow {
  /** Monday (UTC) of the week, `YYYY-MM-DD`. */
  weekStart: string;
  count: number;
}

export interface GhostRow {
  cardId: string;
  title: string;
  stage: string;
  days: number;
}

export interface CareerAnalytics {
  funnel: Funnel;
  bySource: SourceRow[];
  perWeek: WeekRow[];
  ghosted: GhostRow[];
  ghostThresholdDays: number;
}

interface StageEntry {
  from: string | null;
  to: string;
  at: string;
}

function parseHistory(raw: string): StageEntry[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StageEntry[]) : [];
  } catch {
    return [];
  }
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export async function getCareerAnalytics(
  userId: string,
  now: Date = new Date(),
  ghostThresholdDays = 21,
  timeZone: string = DEFAULT_TIME_ZONE,
  weekStart: WeekStart = "mon",
): Promise<CareerAnalytics> {
  const board = await ensureJobBoard(userId);
  const payload = await getBoard(userId, board.id);
  const funnel = await getFunnel(userId, now);

  const applications = await db
    .select()
    .from(job_applications)
    .where(eq(job_applications.user_id, userId));
  const cardsById = new Map(payload.cards.map((card) => [card.id, card]));

  const sources = new Map<string, { total: number; progressed: number }>();
  for (const application of applications) {
    const card = cardsById.get(application.card_id);
    if (!card) continue; // trashed/archived cards are not part of analytics
    const key = application.source?.trim() || "(none)";
    const entry = sources.get(key) ?? { total: 0, progressed: 0 };
    entry.total += 1;
    if (parseHistory(application.stage_history).length > 1) entry.progressed += 1;
    sources.set(key, entry);
  }
  const bySource: SourceRow[] = [...sources.entries()]
    .map(([source, entry]) => ({
      source,
      total: entry.total,
      progressed: entry.progressed,
      rate: entry.total === 0 ? 0 : round2(entry.progressed / entry.total),
    }))
    .sort((a, b) => b.total - a.total || a.source.localeCompare(b.source));

  // Applications per week, bucketed by the user's day and week start (ADR-058/061).
  const thisWeek = startOfWeekInTimeZone(now, timeZone, weekStart);
  const perWeek: WeekRow[] = [];
  for (let offset = WEEKS - 1; offset >= 0; offset -= 1) {
    const weekStartKey = shiftDay(thisWeek, -offset * 7);
    const weekEndKey = shiftDay(weekStartKey, 7); // exclusive
    const count = applications.filter((application) => {
      const created = dayKeyInTimeZone(new Date(application.created_at), timeZone);
      return created >= weekStartKey && created < weekEndKey;
    }).length;
    perWeek.push({ weekStart: weekStartKey, count });
  }

  const ghosted = await getFollowUpsDue(userId, now, ghostThresholdDays);

  return { funnel, bySource, perWeek, ghosted, ghostThresholdDays: ghostThresholdDays };
}

/**
 * Open applications with no stage change for `thresholdDays` — the "stale application" rule,
 * shared by the analytics page (21 days → "ghosted") and the notification sweep's follow-up
 * nudge (7 days, ADR-047), so one definition answers both instead of two that drift.
 */
export async function getFollowUpsDue(
  userId: string,
  now: Date = new Date(),
  thresholdDays = 7,
): Promise<GhostRow[]> {
  const rows = await db
    .select({
      cardId: job_applications.card_id,
      history: job_applications.stage_history,
      createdAt: job_applications.created_at,
      title: cards.title,
    })
    .from(job_applications)
    .innerJoin(cards, eq(cards.id, job_applications.card_id))
    .where(
      and(
        eq(job_applications.user_id, userId),
        isNull(cards.deleted_at),
        isNull(cards.archived_at),
        isNull(cards.completed_at),
      ),
    );

  const due: GhostRow[] = [];
  for (const row of rows) {
    const history = parseHistory(row.history);
    const last = history.at(-1);
    const stage = last?.to ?? "—";
    if (TERMINAL_STAGES.has(stage)) continue;
    const since = new Date(last?.at ?? row.createdAt).getTime();
    const days = Math.floor((now.getTime() - since) / DAY_MS);
    if (days >= thresholdDays) due.push({ cardId: row.cardId, title: row.title, stage, days });
  }
  due.sort((a, b) => b.days - a.days);
  return due;
}
