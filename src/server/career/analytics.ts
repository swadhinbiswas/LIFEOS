import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { job_applications } from "@/server/db/schema";
import { getBoard } from "@/server/boards";

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

const startOfUtcWeek = (date: Date): Date => {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7)); // Monday
  return day;
};

export async function getCareerAnalytics(
  userId: string,
  now: Date = new Date(),
  ghostThresholdDays = 21,
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

  const currentWeek = startOfUtcWeek(now);
  const perWeek: WeekRow[] = [];
  for (let offset = WEEKS - 1; offset >= 0; offset -= 1) {
    const start = new Date(currentWeek.getTime() - offset * 7 * DAY_MS);
    const end = new Date(start.getTime() + 7 * DAY_MS);
    const count = applications.filter((application) => {
      const created = new Date(application.created_at).getTime();
      return created >= start.getTime() && created < end.getTime();
    }).length;
    perWeek.push({ weekStart: start.toISOString().slice(0, 10), count });
  }

  const ghosted: GhostRow[] = [];
  for (const application of applications) {
    const card = cardsById.get(application.card_id);
    if (!card || card.completed_at) continue;
    const history = parseHistory(application.stage_history);
    const last = history.at(-1);
    const stage = last?.to ?? "—";
    if (TERMINAL_STAGES.has(stage)) continue;
    const since = new Date(last?.at ?? application.created_at).getTime();
    const days = Math.floor((now.getTime() - since) / DAY_MS);
    if (days >= ghostThresholdDays) {
      ghosted.push({ cardId: card.id, title: card.title, stage, days });
    }
  }
  ghosted.sort((a, b) => b.days - a.days);

  return { funnel, bySource, perWeek, ghosted, ghostThresholdDays: ghostThresholdDays };
}
